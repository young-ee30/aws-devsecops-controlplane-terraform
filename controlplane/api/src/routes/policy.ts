import { Router } from 'express'
import { applyPolicyworkflow } from '../policy/apply.js'
import { generatePolicyFromPdf } from '../policy/generate.js'
import { removePolicyWorkflow } from '../policy/remove.js'
import {
  createRegistryPolicies,
  deleteRegistryPolicy,
  getRegistryPolicy,
  listRegistryPolicies,
  updateRegistryPolicy,
  type RegistryPolicy,
} from '../policy/registry.js'

interface GeneratePolicyBody {
  fileName?: string
  contentBase64?: string
  mimeType?: string
}

interface ApplyPolicyBody {
  policies?: Array<{
    policyPath?: string
    yaml?: string
    policyName?: string
    summary?: string
  }>
  policyPath?: string
  yaml?: string
  policyName?: string
  summary?: string
}

interface DeactivatePolicyBody {
  id?: string
}

interface RegistryPolicyBody {
  policies?: RegistryPolicy[]
}

interface UpdateRegistryPolicyBody {
  status?: RegistryPolicy['status']
  lastUpdated?: string
  appliedPullRequest?: RegistryPolicy['appliedPullRequest']
}

export const policyRouter = Router()

policyRouter.get('/api/policies/registry', async (_req, res, next) => {
  try {
    const policies = await listRegistryPolicies()
    res.json({ ok: true, policies })
  } catch (error) {
    next(error)
  }
})

policyRouter.post('/api/policies/registry', async (req, res, next) => {
  try {
    const body = req.body as RegistryPolicyBody
    const policies = await createRegistryPolicies(Array.isArray(body.policies) ? body.policies : [])
    res.json({ ok: true, policies })
  } catch (error) {
    next(error)
  }
})

policyRouter.patch('/api/policies/registry/:id', async (req, res, next) => {
  try {
    const body = req.body as UpdateRegistryPolicyBody
    const policy = await updateRegistryPolicy(req.params.id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.lastUpdated ? { lastUpdated: body.lastUpdated } : {}),
      ...(body.appliedPullRequest !== undefined ? { appliedPullRequest: body.appliedPullRequest } : {}),
    })

    if (!policy) {
      res.status(404).json({ error: 'Policy not found' })
      return
    }

    res.json({ ok: true, policy })
  } catch (error) {
    next(error)
  }
})

policyRouter.delete('/api/policies/registry/:id', async (req, res, next) => {
  try {
    const policy = await getRegistryPolicy(req.params.id)
    if (!policy) {
      res.status(404).json({ error: 'Policy not found' })
      return
    }

    const removal = await removePolicyWorkflow(policy)
    await deleteRegistryPolicy(req.params.id)

    res.json(removal)
  } catch (error) {
    next(error)
  }
})

policyRouter.post('/api/policies/deactivate', async (req, res, next) => {
  try {
    const body = req.body as DeactivatePolicyBody
    const id = body.id?.trim()

    if (!id) {
      res.status(400).json({ error: 'Policy id is required' })
      return
    }

    const policy = await getRegistryPolicy(id)
    if (!policy) {
      res.status(404).json({ error: 'Policy not found' })
      return
    }

    const result = await removePolicyWorkflow(policy)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

policyRouter.post('/api/policies/generate', async (req, res, next) => {
  try {
    const body = req.body as GeneratePolicyBody

    const result = await generatePolicyFromPdf({
      fileName: body.fileName || '',
      contentBase64: body.contentBase64 || '',
      mimeType: body.mimeType,
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

policyRouter.post('/api/policies/apply', async (req, res, next) => {
  try {
    const body = req.body as ApplyPolicyBody

    const result = await applyPolicyworkflow({
      policies: Array.isArray(body.policies)
        ? body.policies.map((policy) => ({
          policyPath: policy.policyPath || '',
          yaml: policy.yaml || '',
          policyName: policy.policyName,
          summary: policy.summary,
        }))
        : body.policyPath && body.yaml
          ? [
            {
              policyPath: body.policyPath,
              yaml: body.yaml,
              policyName: body.policyName,
              summary: body.summary,
            },
          ]
          : [],
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})
