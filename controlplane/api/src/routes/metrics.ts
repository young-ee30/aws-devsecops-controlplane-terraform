import { Router } from 'express'
import { env } from '../config/env.js'

const DEFAULT_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

export const metricsRouter = Router()

metricsRouter.get('/api/metrics', async (_req, res, next) => {
  try {
    if (!env.metricsSourceUrl) {
      res.type(DEFAULT_CONTENT_TYPE).send('')
      return
    }

    const upstream = await fetch(env.metricsSourceUrl)
    const payload = await upstream.text()

    res
      .status(upstream.status)
      .type(upstream.headers.get('content-type') || DEFAULT_CONTENT_TYPE)
      .send(payload)
  } catch (error) {
    next(error)
  }
})
