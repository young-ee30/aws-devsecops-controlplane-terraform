import { env } from '../config/env.js'
import { commitFilesToDefaultBranch } from '../github/changes.js'
import { getRepoOctokit, getRepositoryMetadata } from '../github/app.js'
import type { RegistryPolicy } from './registry.js'

export interface RemovePolicyResponse {
  ok: true
  deleted: true
  githubFileDeleted: boolean
  branchName?: string
  commitSha?: string
}

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

function slugify(value: string) {
  return value
    .replace(/\.ya?ml$/i, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase()
}

function validatePolicyPath(policyPath: string) {
  const normalized = policyPath.trim()

  if (!/^security\/checkov\/custom_policies\/[A-Za-z0-9._-]+\.ya?ml$/.test(normalized)) {
    throw createHttpError(400, 'policyPath must point to security/checkov/custom_policies/*.yaml')
  }

  return normalized
}

async function checkFileExistsOnDefaultBranch(policyPath: string, ref: string) {
  const octokit = await getRepoOctokit()

  try {
    await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: env.githubOwner,
      repo: env.githubRepo,
      path: policyPath,
      ref,
    })

    return true
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined
    if (status === 404) {
      return false
    }

    throw error
  }
}

export async function removePolicyWorkflow(policy: RegistryPolicy): Promise<RemovePolicyResponse> {
  const policyPath = validatePolicyPath(policy.policyPath)
  const repository = await getRepositoryMetadata()
  const baseBranch = repository.default_branch
  const existsOnBase = await checkFileExistsOnDefaultBranch(policyPath, baseBranch)

  if (!existsOnBase) {
    return {
      ok: true,
      deleted: true,
      githubFileDeleted: false,
    }
  }

  const fileName = policyPath.split('/').pop() || 'policy.yaml'
  const slug = slugify(fileName) || `policy-${Date.now()}`
  const result = await commitFilesToDefaultBranch({
    runId: `policy-delete-${Date.now()}`,
    commitMessage: `policy: remove ${fileName}`,
    files: [
      {
        path: policyPath,
        delete: true,
      },
    ],
  })

  return {
    ok: true,
    deleted: true,
    githubFileDeleted: true,
    branchName: result.branchName,
    commitSha: result.commitSha,
  }
}
