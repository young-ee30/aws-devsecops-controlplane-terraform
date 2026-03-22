import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, SkipForward, Circle } from 'lucide-react'

interface StepInfo {
  name: string
  number: number
  status: string
  conclusion: string | null
  summary?: string
  durationSeconds?: number | null
  startedAt?: string | null
  completedAt?: string | null
}

interface StepTimelineProps {
  steps: StepInfo[]
  activeStepNumber?: number | null
  onStepClick?: (step: StepInfo) => void
  stepDomIdPrefix?: string
}

function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function getStepIcon(status: string, conclusion: string | null) {
  const base = 'h-4 w-4 shrink-0'
  if (status !== 'completed') {
    return <Clock className={cn(base, 'text-blue-500 animate-pulse')} />
  }
  if (conclusion === 'success') {
    return <CheckCircle2 className={cn(base, 'text-green-500')} />
  }
  if (conclusion === 'failure') {
    return <XCircle className={cn(base, 'text-red-500')} />
  }
  if (conclusion === 'skipped') {
    return <SkipForward className={cn(base, 'text-gray-400')} />
  }
  return <Circle className={cn(base, 'text-gray-400')} />
}

function getLineColor(status: string, conclusion: string | null): string {
  if (status !== 'completed') return 'bg-blue-300'
  if (conclusion === 'success') return 'bg-green-300'
  if (conclusion === 'failure') return 'bg-red-300'
  return 'bg-gray-200'
}

function getStepHighlight(status: string, conclusion: string | null): string {
  if (status !== 'completed') return 'bg-blue-50 border-blue-200'
  if (conclusion === 'failure') return 'bg-red-50 border-red-200'
  return 'bg-white border-gray-100'
}

export default function StepTimeline({ steps, activeStepNumber, onStepClick, stepDomIdPrefix }: StepTimelineProps) {
  if (steps.length === 0) return null

  return (
    <div className="px-4 py-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
        단계별 진행
      </p>
      <div className="relative">
        {steps.map((step, index) => {
          const duration = step.durationSeconds != null
            ? formatSeconds(step.durationSeconds)
            : step.startedAt
              ? formatSeconds(computeDuration(step.startedAt, step.completedAt))
              : ''
          const active = activeStepNumber === step.number
          const cardClass = cn(
            'mb-2 flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
            getStepHighlight(step.status, step.conclusion),
            onStepClick && 'cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/60',
            active && 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-100',
          )
          const cardId = stepDomIdPrefix ? `${stepDomIdPrefix}-${step.number}` : undefined
          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    step.conclusion === 'failure' ? 'text-red-700' : 'text-gray-800',
                  )}
                >
                  {step.name}
                </span>
                {duration && (
                  <span className="shrink-0 text-xs text-gray-400">{duration}</span>
                )}
              </div>
              {step.summary && (
                <p
                  className={cn(
                    'mt-1 text-xs leading-relaxed',
                    step.conclusion === 'failure' ? 'text-red-600' : 'text-gray-500',
                  )}
                >
                  {step.summary}
                </p>
              )}
            </>
          )

          return (
            <div key={`step-${step.number}`} className="flex gap-3">
              {/* Timeline line + icon */}
              <div className="flex flex-col items-center">
                <div className="flex h-7 items-center">
                  {getStepIcon(step.status, step.conclusion)}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn('w-0.5 flex-1 min-h-[16px]', getLineColor(step.status, step.conclusion))}
                  />
                )}
              </div>

              {/* Step content */}
              {onStepClick ? (
                <button id={cardId} type="button" className={cardClass} onClick={() => onStepClick(step)}>
                  {content}
                </button>
              ) : (
                <div id={cardId} className={cardClass}>
                  {content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function computeDuration(startedAt: string | null | undefined, completedAt: string | null | undefined): number | null {
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.floor((end - start) / 1000)
}
