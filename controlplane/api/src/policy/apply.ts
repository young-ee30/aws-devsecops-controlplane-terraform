import { commitFilesToDefaultBranch } from '../github/changes.js'

export interface ApplyPolicyFileInput {
  policyPath: string
  yaml: string
  policyName?: string
  summary?: string
}

export interface ApplyPolicyRequest {
  policies: ApplyPolicyFileInput[]
}

export interface ApplyPolicyResponse {
  ok: true
  policyPaths: string[]
  fileCount: number
  branchName: string
  commitSha: string
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

function validatePolicyFile(input: ApplyPolicyFileInput) {
  const policyPath = input.policyPath.trim()
  const yaml = input.yaml.trim()

  if (!policyPath) {
    throw createHttpError(400, 'policyPath is required')
  }

  if (!/^security\/checkov\/custom_policies\/[A-Za-z0-9._-]+\.ya?ml$/.test(policyPath)) {
    throw createHttpError(400, 'policyPath must point to security/checkov/custom_policies/*.yaml')
  }

  if (!yaml) {
    throw createHttpError(400, 'yaml is required')
  }

  if (!/metadata:\s*[\s\S]*definition:/i.test(yaml)) {
    throw createHttpError(400, 'yaml must contain Checkov metadata and definition blocks')
  }

  return {
    policyPath,
    yaml,
    policyName: input.policyName?.trim() || undefined,
    summary: input.summary?.trim() || undefined,
  }
}

export async function applyPolicyworkflow(input: ApplyPolicyRequest): Promise<ApplyPolicyResponse> {
  const rawPolicies = Array.isArray(input.policies) ? input.policies : []

  if (rawPolicies.length === 0) {
    throw createHttpError(400, 'policies must contain at least one policy file')
  }

  const policies = rawPolicies.map(validatePolicyFile)
  const pathSet = new Set<string>()

  for (const policy of policies) {
    if (pathSet.has(policy.policyPath)) {
      throw createHttpError(400, `Duplicate policyPath provided: ${policy.policyPath}`)
    }
    pathSet.add(policy.policyPath)
  }

  const firstFileName = policies[0]?.policyPath.split('/').pop() || 'policy.yaml'
  const slug = slugify(firstFileName) || `policy-${Date.now()}`
  const result = await commitFilesToDefaultBranch({
    runId: `policy-${Date.now()}`,
    commitMessage:
      policies.length === 1 ? `policy: add ${firstFileName}` : `policy: add ${policies.length} custom policies`,
    files: policies.map((policy) => ({
      path: policy.policyPath,
      content: policy.yaml,
    })),
  })

  return {
    ok: true,
    policyPaths: policies.map((policy) => policy.policyPath),
    fileCount: policies.length,
    branchName: result.branchName,
    commitSha: result.commitSha,
  }
}
