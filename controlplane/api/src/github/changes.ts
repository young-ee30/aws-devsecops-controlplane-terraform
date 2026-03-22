import { env } from '../config/env.js'
import { getRepoOctokit, getRepositoryMetadata } from './app.js'

export interface ConfirmFileChange {
  path: string
  content?: string
  delete?: boolean
}

export interface ConfirmChangesInput {
  runId: string
  baseBranch?: string
  branchName?: string
  commitMessage?: string
  prTitle?: string
  prBody?: string
  files: ConfirmFileChange[]
}

export interface CommitFilesInput {
  runId: string
  branchName?: string
  commitMessage?: string
  files: ConfirmFileChange[]
}

function sanitizeBranchName(value: string) {
  return value.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\/+/g, '/')
}

function encodeContent(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64')
}

async function reserveBranchName(baseBranch: string, requested?: string) {
  const octokit = await getRepoOctokit()
  const baseRef = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    ref: `heads/${baseBranch}`,
  })

  const baseCommitSha = baseRef.data.object.sha
  const baseName = sanitizeBranchName(requested || `ai-fix/run-${Date.now()}`)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? baseName : `${baseName}-${Date.now()}-${attempt}`

    try {
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: env.githubOwner,
        repo: env.githubRepo,
        ref: `refs/heads/${candidate}`,
        sha: baseCommitSha,
      })

      return {
        branchName: candidate,
        baseCommitSha,
      }
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? error.status : undefined
      if (status !== 422) throw error
    }
  }

  throw new Error('Failed to allocate a unique branch name')
}

async function buildTreeEntries(files: ConfirmFileChange[]) {
  const octokit = await getRepoOctokit()

  return Promise.all(
    files.map(async (file) => {
      if (!file.path.trim()) {
        throw new Error('Each file change must include a path')
      }

      if (file.delete) {
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: null,
        }
      }

      if (typeof file.content !== 'string') {
        throw new Error(`File change ${file.path} must include content unless delete=true`)
      }

      const blob = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner: env.githubOwner,
        repo: env.githubRepo,
        content: encodeContent(file.content),
        encoding: 'base64',
      })

      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      }
    }),
  )
}

export async function createPullRequestFromFiles(input: ConfirmChangesInput) {
  if (input.files.length === 0) {
    throw new Error('files must contain at least one file change')
  }

  const octokit = await getRepoOctokit()
  const repository = await getRepositoryMetadata()
  const baseBranch = input.baseBranch || repository.default_branch
  const commitMessage = input.commitMessage || `ai fix: workflow run ${input.runId}`
  const prTitle = input.prTitle || `AI fix for failed workflow run ${input.runId}`
  const prBody = input.prBody || 'Generated from dashboard after user confirmation.'

  const { branchName, baseCommitSha } = await reserveBranchName(baseBranch, input.branchName || `ai-fix/run-${input.runId}`)

  const baseCommit = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    commit_sha: baseCommitSha,
  })

  const tree = await buildTreeEntries(input.files)

  const newTree = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    base_tree: baseCommit.data.tree.sha,
    tree,
  })

  const commit = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    message: commitMessage,
    tree: newTree.data.sha,
    parents: [baseCommitSha],
  })

  await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    ref: `heads/${branchName}`,
    sha: commit.data.sha,
    force: false,
  })

  const pullRequest = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    title: prTitle,
    head: branchName,
    base: baseBranch,
    body: prBody,
  })

  return {
    ok: true,
    baseBranch,
    branchName,
    commitSha: commit.data.sha,
    pullRequest: {
      number: pullRequest.data.number,
      htmlUrl: pullRequest.data.html_url,
      title: pullRequest.data.title,
    },
  }
}

export async function commitFilesToDefaultBranch(input: CommitFilesInput) {
  if (input.files.length === 0) {
    throw new Error('files must contain at least one file change')
  }

  const octokit = await getRepoOctokit()
  const repository = await getRepositoryMetadata()
  const branchName = input.branchName || repository.default_branch
  const commitMessage = input.commitMessage || `ai fix: workflow run ${input.runId}`

  const baseRef = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    ref: `heads/${branchName}`,
  })

  const baseCommitSha = baseRef.data.object.sha
  const baseCommit = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    commit_sha: baseCommitSha,
  })

  const tree = await buildTreeEntries(input.files)
  const newTree = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    base_tree: baseCommit.data.tree.sha,
    tree,
  })

  const commit = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    message: commitMessage,
    tree: newTree.data.sha,
    parents: [baseCommitSha],
  })

  await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    ref: `heads/${branchName}`,
    sha: commit.data.sha,
    force: false,
  })

  return {
    ok: true,
    branchName,
    commitSha: commit.data.sha,
  }
}
