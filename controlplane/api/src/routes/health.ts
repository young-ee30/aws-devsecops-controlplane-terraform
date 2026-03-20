import { Router } from 'express'
import { env } from '../config/env.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'controlplane-api',
    nodeEnv: env.nodeEnv,
    githubOwner: env.githubOwner,
    githubRepo: env.githubRepo,
  })
})
