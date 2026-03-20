import { env } from '../config/env.js'
import { getInstallationToken, getRepoOctokit, getRepositoryMetadata } from './app.js'

type WorkflowDispatchInput = Record<string, string | number | boolean>

function formatConclusion(value: string | null | undefined): string {
  return value || 'unknown'
}

export async function listWorkflowRuns(limit = 20) {
  const octokit = await getRepoOctokit()
  const response = await octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    per_page: limit,
  })

  return response.data.workflow_runs.map((run) => ({
    id: run.id,
    name: run.name,
    displayTitle: run.display_title,
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    branch: run.head_branch,
    sha: run.head_sha,
    htmlUrl: run.html_url,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    actor: run.actor?.login || null,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }))
}

export async function getWorkflowRunJobs(runId: number) {
  const octokit = await getRepoOctokit()
  const response = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    run_id: runId,
    per_page: 100,
  })

  return response.data.jobs.map((job) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    htmlUrl: job.html_url,
    runnerName: job.runner_name,
    labels: job.labels || [],
    steps: (job.steps || []).map((step) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      startedAt: step.started_at,
      completedAt: step.completed_at,
    })),
  }))
}

async function fetchJobLogText(jobId: number) {
  const token = await getInstallationToken()

  const redirectResponse = await fetch(
    `https://api.github.com/repos/${env.githubOwner}/${env.githubRepo}/actions/jobs/${jobId}/logs`,
    {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'controlplane-api',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (redirectResponse.status >= 300 && redirectResponse.status < 400) {
    const location = redirectResponse.headers.get('location')
    if (!location) {
      throw new Error('GitHub did not return a log download URL')
    }

    const downloadResponse = await fetch(location, {
      headers: {
        'User-Agent': 'controlplane-api',
      },
    })

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download job logs: HTTP ${downloadResponse.status}`)
    }

    return downloadResponse.text()
  }

  if (!redirectResponse.ok) {
    throw new Error(`Failed to resolve job logs: HTTP ${redirectResponse.status}`)
  }

  return redirectResponse.text()
}

export async function getWorkflowRunLogs(runId: number, requestedJobId?: number) {
  const jobs = await getWorkflowRunJobs(runId)

  const selectedJobs = requestedJobId
    ? jobs.filter((job) => job.id === requestedJobId)
    : jobs.filter((job) => formatConclusion(job.conclusion) !== 'success')

  const effectiveJobs = selectedJobs.length > 0 ? selectedJobs : jobs.slice(0, 3)

  const logs = await Promise.all(
    effectiveJobs.map(async (job) => ({
      jobId: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      content: await fetchJobLogText(job.id),
    })),
  )

  return {
    runId,
    selectedJobIds: effectiveJobs.map((job) => job.id),
    logs,
  }
}

export async function rerunFailedJobs(runId: number) {
  const octokit = await getRepoOctokit()

  await octokit.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    run_id: runId,
  })

  return {
    ok: true,
    runId,
    message: 'Requested rerun for failed jobs',
  }
}

export async function dispatchWorkflow(workflowId: string, ref?: string, inputs?: WorkflowDispatchInput) {
  const octokit = await getRepoOctokit()
  const repository = await getRepositoryMetadata()
  const targetRef = ref || repository.default_branch

  const normalizedInputs = Object.fromEntries(
    Object.entries(inputs || {}).map(([key, value]) => [key, String(value)]),
  )

  await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
    owner: env.githubOwner,
    repo: env.githubRepo,
    workflow_id: workflowId,
    ref: targetRef,
    inputs: normalizedInputs,
  })

  return {
    ok: true,
    workflowId,
    ref: targetRef,
  }
}
