import { Link, useSearchParams } from 'react-router-dom'

export default function GithubInstalledPage() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action')
  const state = searchParams.get('state')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">GitHub App Setup</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">GitHub App installation completed</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This page is the local Setup URL target after the app is installed. The current MVP uses
            installation tokens and polling, so this page is informational for now.
          </p>

          <div className="mt-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
            <InfoRow label="installation_id" value={installationId} />
            <InfoRow label="setup_action" value={setupAction} />
            <InfoRow label="state" value={state} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/git-actions"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-300"
            >
              Open Git Actions
            </Link>
            <Link
              to="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="font-mono text-xs text-slate-200">{value ?? 'not provided'}</span>
    </div>
  )
}
