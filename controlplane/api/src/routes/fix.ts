import { Router } from 'express'
import { createPullRequestFromFiles } from '../github/changes.js'
import { env } from '../config/env.js'

interface ConfirmRequestBody {
  baseBranch?: string
  branchName?: string
  commitMessage?: string
  prTitle?: string
  prBody?: string
  files?: Array<{
    path: string
    content: string
  }>
}

export const fixRouter = Router()

fixRouter.post('/api/github/fix-sessions/:runId/suggest', async (req, res) => {
  const runId = req.params.runId

  res.status(501).json({
    ok: false,
    runId,
    message: 'Suggest endpoint is not implemented yet.',
    configuredModel: env.llmModel,
  })
})

fixRouter.post('/api/github/fix-sessions/:runId/confirm', async (req, res, next) => {
  try {
    const runId = req.params.runId
    const body = req.body as ConfirmRequestBody
    const files = body.files || []

    if (files.length === 0) {
      res.status(400).json({ error: 'files must contain at least one file change' })
      return
    }

    const invalid = files.find((file) => typeof file.path !== 'string' || typeof file.content !== 'string')
    if (invalid) {
      res.status(400).json({ error: 'Each file must include string path and content' })
      return
    }

    const result = await createPullRequestFromFiles({
      runId,
      baseBranch: body.baseBranch,
      branchName: body.branchName,
      commitMessage: body.commitMessage,
      prTitle: body.prTitle,
      prBody: body.prBody,
      files,
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})
