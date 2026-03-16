import { useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/Header'
import ChartCard from '@/components/common/ChartCard'
import { policySummary, policyTemplates, type PolicyStatus, type PolicyTemplate } from '@/data/mockData'

const policyStatusStyles: Record<PolicyStatus, { label: string; className: string }> = {
  active: { label: '활성', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  draft: { label: '초안', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  paused: { label: '일시중지', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function buildPolicyYaml(source: string) {
  const slug = source.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()

  return `name: "${slug}"
on:
  pull_request:
  push:
    branches: [main]

jobs:
  checkov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bridgecrewio/checkov-action@master
        with:
          framework: terraform,cloudformation,kubernetes
          soft_fail: false
`
}

function PolicyUploadCard({ onCreate }: { onCreate: (policy: PolicyTemplate) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [converting, setConverting] = useState(false)
  const [yaml, setYaml] = useState('')
  const [created, setCreated] = useState(false)

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return
    setSelectedFile(file)
    setConverting(true)
    setCreated(false)
    setYaml('')

    window.setTimeout(() => {
      setYaml(buildPolicyYaml(file.name))
      setConverting(false)
    }, 1200)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setConverting(false)
    setYaml('')
    setCreated(false)
  }

  const handleCreate = () => {
    if (!selectedFile || !yaml) return

    const name = selectedFile.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
    onCreate({
      id: `policy-${Date.now()}`,
      name,
      description: `${name} 기준으로 IaC 보안 구성을 점검하는 더미 정책입니다.`,
      source: selectedFile.name,
      checks: Math.floor(Math.random() * 60) + 30,
      status: 'draft',
      lastUpdated: '방금 전',
      yaml,
    })
    setCreated(true)
  }

  return (
    <ChartCard title="보안 정책 추가" subtitle="PDF 업로드 후 더미 YAML 초안 생성" showActions={false}>
      <div className="space-y-4">
        {!selectedFile && (
          <div
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              const file = event.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          >
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${
              dragOver ? 'border-indigo-200 bg-indigo-100' : 'border-gray-200 bg-gray-100'
            }`}>
              <Upload className={`h-7 w-7 ${dragOver ? 'text-indigo-600' : 'text-gray-400'}`} />
            </div>
            <p className="text-base font-medium text-gray-800">PDF 파일을 드래그하거나 클릭해 업로드</p>
            <p className="mt-1 text-sm text-gray-500">실제 백엔드 없이 로컬 더미 데이터로 정책을 생성합니다.</p>
            <span className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
              파일 선택
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
        )}

        {selectedFile && (
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50">
              <FileText className="h-4.5 w-4.5 text-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{selectedFile.name}</p>
              <p className="mt-0.5 text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(0)} KB · PDF</p>
            </div>
            {!created && (
              <button
                onClick={handleReset}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {converting && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-5">
            <p className="text-sm font-medium text-indigo-700">정책 문서를 분석해 YAML을 생성하고 있습니다...</p>
            <p className="mt-1 text-xs text-gray-500">더미 데이터 기반 변환이라 새로고침하면 초기 상태로 돌아갑니다.</p>
          </div>
        )}

        {yaml && !converting && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <p className="text-sm font-medium text-indigo-700">YAML 생성 완료</p>
              </div>
              <span className="rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs text-gray-500">
                .github/workflows/{selectedFile?.name.replace(/\.pdf$/i, '').toLowerCase()}.yml
              </span>
            </div>

            <pre className="max-h-56 overflow-auto rounded-xl border border-gray-700 bg-gray-950 p-4 font-mono text-xs leading-relaxed text-gray-100">
              {yaml}
            </pre>

            {!created ? (
              <button
                onClick={handleCreate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <FilePlus className="h-4 w-4" />
                정책 추가하기
              </button>
            ) : (
              <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-medium text-indigo-700">
                <CheckCircle2 className="h-4 w-4" />
                더미 정책이 추가되었습니다
              </div>
            )}
          </div>
        )}
      </div>
    </ChartCard>
  )
}

function PolicyList({
  policies,
  onToggleStatus,
  onDelete,
}: {
  policies: PolicyTemplate[]
  onToggleStatus: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [openYamlId, setOpenYamlId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (policy: PolicyTemplate) => {
    try {
      await navigator.clipboard.writeText(policy.yaml)
      setCopiedId(policy.id)
      window.setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setCopiedId(null)
    }
  }

  return (
    <div className="space-y-4">
      {policies.map((policy) => {
        const status = policyStatusStyles[policy.status]
        const isOpen = openYamlId === policy.id

        return (
          <div key={policy.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
                      <ShieldCheck className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{policy.name}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{policy.source}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">{policy.description}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${status.className}`}>{status.label}</span>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '검사 규칙', value: `${policy.checks}개` },
                  { label: '마지막 갱신', value: policy.lastUpdated },
                  { label: '현재 상태', value: status.label },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {isOpen && (
                <pre className="max-h-48 overflow-auto rounded-xl border border-gray-700 bg-gray-950 p-4 font-mono text-xs leading-relaxed text-gray-100">
                  {policy.yaml}
                </pre>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setOpenYamlId((current) => (current === policy.id ? null : policy.id))}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100"
                >
                  {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {isOpen ? 'YAML 숨기기' : 'YAML 보기'}
                </button>
                <button
                  onClick={() => handleCopy(policy)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100"
                >
                  {copiedId === policy.id ? <Check className="h-3.5 w-3.5 text-indigo-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === policy.id ? '복사됨' : '복사'}
                </button>
                <button
                  onClick={() => onToggleStatus(policy.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 transition-colors hover:bg-indigo-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {policy.status === 'active' ? '정책 일시중지' : '정책 활성화'}
                </button>
                <button
                  onClick={() => onDelete(policy.id)}
                  className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PolicyPage() {
  const [policies, setPolicies] = useState(policyTemplates)

  const handleCreatePolicy = (policy: PolicyTemplate) => {
    setPolicies((current) => [policy, ...current])
  }

  const handleTogglePolicyStatus = (id: string) => {
    setPolicies((current) =>
      current.map((policy) =>
        policy.id === id
          ? {
              ...policy,
              status: policy.status === 'active' ? 'paused' : 'active',
              lastUpdated: '방금 전',
            }
          : policy,
      ),
    )
  }

  const handleDeletePolicy = (id: string) => {
    setPolicies((current) => current.filter((policy) => policy.id !== id))
  }

  return (
    <div>
      <PageHeader
        title="보안 정책"
        subtitle="Git Actions 아래 별도 페이지로 분리된 더미 정책 관리 화면입니다."
        lastUpdated="방금 전"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6">
        {policySummary.map((item) => {
          const tone =
            item.tone === 'blue'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : item.tone === 'green'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-100 text-gray-800 border-gray-200'

          return (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">{item.label}</p>
              <div className={`mt-3 inline-flex rounded-xl border px-4 py-2 ${tone}`}>
                <span className="text-3xl font-semibold">{item.value}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <PolicyUploadCard onCreate={handleCreatePolicy} />

        <ChartCard title="정책 목록" subtitle="더미 상태 변경은 새로고침 시 초기화됩니다." showActions={false}>
          <PolicyList policies={policies} onToggleStatus={handleTogglePolicyStatus} onDelete={handleDeletePolicy} />
        </ChartCard>
      </div>
    </div>
  )
}
