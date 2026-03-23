# Policy Page Technical Guide

## 개요

이 문서는 `/policy` 페이지가 어떤 파일들로 구성되어 있고, PDF 보안 가이드를 어떤 과정을 거쳐 Checkov custom policy YAML로 바꾸는지 설명하는 기술 문서다.

이 페이지의 핵심 목적은 단순 업로드가 아니다.

- 보안 가이드 PDF 업로드
- PDF 텍스트 추출
- 통제 항목 단위 분리
- 로컬 규칙 기반 정규화
- LLM을 통한 정책 초안 생성
- validator와 repair를 통한 품질 보정
- preview 확인
- registry 저장
- GitHub 저장소 반영

중요한 점은 정책 생성 AI가 PDF 원문 전체를 직접 받지 않는다는 것이다. 먼저 서버 코드가 PDF를 읽고 `NormalizedControl`이라는 압축 JSON을 만든 뒤, 그 JSON만 LLM에 전달한다.

## 이 페이지에 필요한 파일 트리

아래 트리는 전체 저장소가 아니라 `/policy` 페이지와 정책 생성 흐름을 이해하는 데 필요한 파일만 추린 것이다.

```text
aws-security-project/
├─ controlplane/
│  ├─ web/
│  │  └─ src/
│  │     ├─ App.tsx                                      # /policy 라우트를 등록한다.
│  │     └─ pages/
│  │        └─ PolicyPage.tsx                            # 업로드, preview, registry 목록, apply/deactivate/delete를 제어하는 메인 페이지
│  └─ api/
│     ├─ data/
│     │  └─ policy-registry.json                         # 생성된 정책 메타데이터를 저장하는 로컬 registry
│     └─ src/
│        ├─ server.ts                                    # Express 서버에 policy router를 연결한다.
│        ├─ routes/
│        │  └─ policy.ts                                 # /api/policies/* HTTP 엔드포인트를 정의한다.
│        ├─ policy/
│        │  ├─ generate.ts                               # PDF 파싱, 통제 분리, 정규화, LLM 생성, validator, repair, preview 응답까지 담당
│        │  ├─ registry.ts                               # policy-registry.json을 읽고 쓴다.
│        │  ├─ apply.ts                                  # 생성된 YAML을 기본 브랜치에 커밋한다.
│        │  └─ remove.ts                                 # 기본 브랜치에서 정책 파일을 삭제한다.
│        ├─ github/
│        │  ├─ app.ts                                    # GitHub App 인증과 installation Octokit 생성
│        │  └─ changes.ts                                # Git Data API로 기본 브랜치에 파일 커밋/삭제
│        └─ llm/
│           └─ client.ts                                 # Gemini 호출 공통 어댑터
├─ security/
│  └─ checkov/
│     └─ custom_policies/                                # 최종 YAML이 저장소에 반영되는 경로
└─ docs/
   └─ policy-with-llm/
      └─ policy-page-technical-guide.md                  # 현재 문서
```

## 기술 스택

| 기술 | 왜 쓰는가 | 실제 위치 |
| --- | --- | --- |
| React + TypeScript + Vite | 업로드, preview, registry, 상태 전환 UI를 안정적으로 구성하기 위해 | `controlplane/web/src/pages/PolicyPage.tsx` |
| Express + TypeScript | PDF 처리와 GitHub 반영을 서버에서 안전하게 수행하기 위해 | `controlplane/api/src/server.ts` |
| `pdf-parse` | PDF에서 실제 텍스트를 뽑기 위해 | `controlplane/api/src/policy/generate.ts` |
| Gemini API | 정규화된 통제 JSON을 Checkov YAML 정책 패키지로 바꾸기 위해 | `controlplane/api/src/llm/client.ts` |
| GitHub App + Octokit | 브라우저가 아닌 서버가 저장소를 수정하도록 만들기 위해 | `controlplane/api/src/github/app.ts` |
| Git Data API | PR 없이 기본 브랜치에 정책 파일을 직접 커밋/삭제하기 위해 | `controlplane/api/src/github/changes.ts` |
| JSON registry | 정책 목록과 상태를 가볍게 관리하기 위해 | `controlplane/api/src/policy/registry.ts` |
| Checkov custom policy YAML | Terraform 리소스를 정적 정책으로 검사하기 위해 | `controlplane/api/src/policy/generate.ts` |

## 전체 연결 구조

```text
사용자
  -> PolicyPage.tsx
  -> /api/policies/generate
  -> routes/policy.ts
  -> generatePolicyFromPdf()
  -> PDF 텍스트 추출
  -> source policy 분리
  -> buildNormalizedControl()
  -> terraform_applicability 판단
  -> Gemini 정책 생성
  -> validatePolicyPackage()
  -> 필요 시 repair 1회
  -> preview 응답
  -> PolicyPage.tsx preview 렌더링

사용자 Apply 클릭
  -> /api/policies/apply
  -> apply.ts
  -> github/app.ts
  -> github/changes.ts
  -> security/checkov/custom_policies/*.yaml 커밋

사용자 Deactivate/Delete 클릭
  -> /api/policies/deactivate 또는 DELETE /api/policies/registry/:id
  -> remove.ts / registry.ts
  -> GitHub 파일 삭제 + registry 상태 반영
```

## 정책은 실제로 어떤 과정으로 생성되는가

### 1. 프론트가 PDF를 업로드한다

`PolicyPage.tsx`는 파일을 읽어 base64로 바꾼 뒤 `POST /api/policies/generate`를 호출한다.

```ts
const analyzeFile = async (file: File) => {
  const contentBase64 = await fileToBase64(file)
  const result = await apiFetch('/api/policies/generate', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      contentBase64,
    }),
  })

  setPreview(result)
}
```

이 시점의 역할은 단순하다.

- 파일 선택
- base64 인코딩
- 생성 API 호출
- 응답 preview 표시

실제 정책 생성은 프론트가 아니라 백엔드에서 수행한다.

### 2. 라우터가 생성 요청을 서비스로 넘긴다

`routes/policy.ts`는 HTTP 엔드포인트만 정의하고, 생성 로직 자체는 `generate.ts`에 위임한다.

```ts
policyRouter.post('/api/policies/generate', async (req, res, next) => {
  const result = await generatePolicyFromPdf({
    fileName: body.fileName || '',
    contentBase64: body.contentBase64 || '',
    mimeType: body.mimeType,
  })
  res.json(result)
})
```

즉 `routes/policy.ts`의 역할은 다음이다.

- request body 검증
- 적절한 service 함수 호출
- 결과를 JSON으로 반환

### 3. PDF 텍스트를 추출하고 통제 항목으로 분리한다

`generate.ts`의 진입점은 `generatePolicyFromPdf()`다.

이 함수는 먼저 업로드 입력을 검증하고, PDF에서 텍스트를 추출한 뒤 문서를 통제 항목 단위로 쪼갠다.

```ts
export async function generatePolicyFromPdf(input: GeneratePolicyRequest): Promise<GeneratePolicyResponse> {
  ...
  const sourcePolicies = extractSourcePolicies(input.fileName, text)
  const llmResult = await generateWithLlm(input.fileName, sourcePolicies)
  ...
}
```

여기서 중요한 함수는 다음 세 개다.

- `extractSourcePolicies()`
  - PDF 전체를 정책 항목 단위로 분리한다.
- `extractPolicySections()`
  - 각 항목에서 `purpose`, `inspectionCriteria`, `risk`, `remediation` 같은 섹션을 뽑는다.
- `extractPolicySignals()`
  - 어떤 리소스 타입과 어떤 검사 차원이 필요한지 힌트를 만든다.

즉 이 단계는 "PDF 전체를 AI에 던지는 단계"가 아니라 "문서를 구조화하는 단계"다.

### 4. 로컬 규칙 기반으로 `NormalizedControl`을 만든다

이 프로젝트에서 가장 중요한 설계 포인트는 LLM보다 먼저 로컬 코드가 정책 생성 근거를 정리한다는 점이다.

`buildNormalizedControl()`은 추출한 섹션과 signals를 이용해 `NormalizedControl`을 만든다.

```ts
function buildNormalizedControl(
  sourcePolicy: SourcePolicyItem,
  baselineDraft: ResolvedPolicyDraft,
  signals: ExtractedPolicySignals,
): NormalizedControl {
  ...
  const allowedEvidenceFields = deriveAllowedEvidenceFields(checkDimensions)
  const forbiddenInferredEvidence = deriveForbiddenInferredEvidence(checkDimensions)
  const requiredResourceFamilies = deriveRequiredResourceFamilies(checkDimensions, resourceCandidates)
  const { terraformApplicability, coverageMode } = classifyTerraformApplicability(
    resourceCandidates,
    enforceableConditions,
    nonEnforceableConditions,
  )

  return {
    control_id: sourcePolicy.sourcePolicyId,
    title: sourcePolicy.sourcePolicyTitle,
    source_severity: baselineDraft.severity,
    provider: baselineDraft.provider,
    target_format: 'checkov_yaml',
    terraform_applicability: terraformApplicability,
    coverage_mode: coverageMode,
    control_objective: ...,
    pass_conditions: ...,
    fail_conditions: ...,
    implementation_examples: ...,
    resource_candidates: resourceCandidates,
    check_dimensions: checkDimensions,
    enforceable_conditions: enforceableConditions,
    non_enforceable_conditions: nonEnforceableConditions,
    allowed_evidence_fields: allowedEvidenceFields,
    forbidden_inferred_evidence: forbiddenInferredEvidence,
    required_resource_families: requiredResourceFamilies,
    generation_constraints: {
      disallow_hardcoded_resource_names: true,
      must_report_uncovered_conditions: true,
      must_not_guess_missing_provider_details: true,
    },
  }
}
```

이 JSON이 중요한 이유는 다음과 같다.

- LLM이 PDF 원문 전체를 보지 않아도 된다.
- 정책 생성 근거가 `enforceable_conditions`, `resource_candidates`, `allowed_evidence_fields` 같은 안정된 필드로 압축된다.
- 태그 추론, 이름 추론, 리소스명 하드코딩 같은 위험한 생성을 validator가 막기 쉬워진다.

### 5. `terraform_applicability`를 보고 AI 호출 여부를 결정한다

모든 정책이 Terraform 정적 정책으로 바뀔 수 있는 것은 아니다.

그래서 `classifySourcePolicyLocally()`가 먼저 로컬 분류를 수행하고, 정적 검사로 다룰 수 없는 통제는 아예 LLM 호출 전에 제외한다.

```ts
function classifySourcePolicyLocally(
  fileName: string,
  sourcePolicy: SourcePolicyItem,
): LocalPolicyClassificationResult {
  const signals = extractPolicySignals(sourcePolicy)
  const fallbackDraft = buildFallbackDraftForSourcePolicy(fileName, sourcePolicy) ?? buildBaseDraftForSourcePolicy(fileName, sourcePolicy)
  const normalizedControl = buildNormalizedControl(sourcePolicy, fallbackDraft, signals)

  if (!signals.likelyConvertible || normalizedControl.terraform_applicability === 'no') {
    return {
      convertible: false,
      reason: 'Local classifier marked this source policy as operational, procedural, or not statically checkable from Terraform.',
      signals,
      normalizedControl,
      fallbackDraft: null,
    }
  }
  ...
}
```

즉 여기서 걸러지는 통제는 다음과 같은 성격이다.

- 운영 절차
- 사람 승인 절차
- 점검 주기
- 문서화 요구사항
- Terraform만으로는 증거를 얻기 어려운 정책

### 6. LLM은 PDF 대신 압축된 `NormalizedControl`만 받는다

`generateWithLlm()`은 각 source policy에 대해 로컬 분류를 마친 뒤, 통과한 항목만 LLM에 보낸다.

```ts
const initialResult = await requestPolicyPackage(
  buildPolicyDefinitionSystemPrompt(),
  buildPolicyUserPrompt(localClassification.normalizedControl),
  POLICY_PACKAGE_MAX_TOKENS,
)
```

여기서 핵심은 `buildPolicyUserPrompt()`가 PDF 원문이 아니라 compact JSON만 넣는다는 점이다.

LLM은 이 입력만 보고 정책 패키지를 생성해야 한다.

- `control_objective`
- `pass_conditions`
- `fail_conditions`
- `enforceable_conditions`
- `resource_candidates`
- `allowed_evidence_fields`
- `forbidden_inferred_evidence`
- `required_resource_families`

즉 정책 생성 AI는 "원문 해석기"라기보다 "정규화된 통제를 Checkov YAML 패키지로 변환하는 코드 생성기"에 가깝다.

### 7. validator가 생성 결과를 강하게 검사한다

이 프로젝트는 LLM 출력물을 바로 저장하지 않는다. `validatePolicyPackage()`가 먼저 강한 검증을 수행한다.

```ts
let validationErrors = validatePolicyPackage(packageCandidate, localClassification.normalizedControl)
```

validator가 검사하는 핵심 항목은 다음과 같다.

- 필수 package key 누락 여부
- `policy_format`이 `checkov_yaml`과 일치하는지
- partial coverage인데 `not_covered_conditions`가 비어 있지 않은지
- YAML의 `metadata.severity`가 source severity와 일치하는지
- Terraform local resource name을 하드코딩했는지
- 금지된 tag 기반 추론을 만들었는지
- tautology 같은 무의미한 항상 참/항상 거짓 로직이 들어갔는지
- `resource_candidates` 밖의 리소스를 썼는지
- top-level `resource_types`와 YAML 내부 `definition.resource_types`가 일치하는지
- 필요한 resource family를 최소 하나라도 커버했는지

즉 validator의 역할은 "AI가 만들어 왔으니 일단 믿는다"가 아니라 "생성 범위를 코드가 다시 강제한다"에 가깝다.

### 8. 실패하면 repair를 1회만 시도한다

처음 생성한 결과가 validator를 통과하지 못하면, 같은 `NormalizedControl`과 validator 에러 목록을 함께 보내서 repair를 1회만 시도한다.

```ts
if (validationErrors.length > 0) {
  const repairResult = await requestPolicyPackage(
    buildPolicyRepairSystemPrompt(),
    buildRepairUserPrompt(localClassification.normalizedControl, packageCandidate, validationErrors),
    POLICY_REPAIR_MAX_TOKENS,
  )
  ...
}
```

이 repair 단계의 목적은 다음과 같다.

- 전체를 다시 생성하지 않고, 잘못된 부분만 고치게 하기
- 유효한 YAML 구조는 유지하고 금지된 추론만 제거하기
- severity, resource family, invented tags 같은 validator 에러를 바로잡기

그래도 실패하면 해당 정책은 skip 처리된다.

### 9. 통과한 YAML만 preview로 돌려준다

validator와 repair를 통과한 결과만 최종 preview 응답에 포함된다.

```ts
const policies = resolvedDrafts.map((draft) => ({
  policyPath: `security/checkov/custom_policies/${draft.fileName}`,
  yaml: draft.yamlContent || buildCustomPolicyYaml(draft),
  ...
}))
```

즉 브라우저가 보는 preview는 "AI 초안"이 아니라 "서버 검증을 통과한 정책 후보"다.

## 핵심 파일별 역할

### `PolicyPage.tsx`

이 파일은 정책 페이지의 프론트 컨트롤러다.

- 파일 업로드
- preview 상태 관리
- registry 목록 로딩
- create
- apply
- deactivate
- delete

백엔드 호출은 대부분 `apiFetch()`를 통해 통일한다.

### `routes/policy.ts`

이 파일은 HTTP 진입점이다.

- `GET /api/policies/registry`
- `POST /api/policies/registry`
- `PATCH /api/policies/registry/:id`
- `DELETE /api/policies/registry/:id`
- `POST /api/policies/generate`
- `POST /api/policies/apply`
- `POST /api/policies/deactivate`

즉 라우터의 책임은 계약이고, 실제 생성/적용 로직은 서비스 모듈에 있다.

### `policy/generate.ts`

이 파일이 정책 생성 엔진이다.

현재는 아래 책임이 하나의 파일 안에 같이 들어 있다.

- PDF 텍스트 추출
- 통제 항목 분리
- 섹션 추출
- signal 추출
- `NormalizedControl` 생성
- applicability 판정
- LLM 프롬프트 생성
- 정책 패키지 생성 호출
- validator
- repair
- 최종 preview 응답 조립

즉 `/policy` 페이지에서 가장 중요한 서버 파일은 `generate.ts`다.

### `llm/client.ts`

이 파일은 LLM 호출 어댑터다.

역할은 단순하다.

- API 키 확인
- provider 결정
- Gemini API 호출

정책 생성 규칙은 여기에 있지 않고, 그 규칙은 `generate.ts`의 프롬프트와 validator에 있다.

### `policy/registry.ts`

이 파일은 정책 메타데이터 저장소다.

- 정책 목록 조회
- 새 정책 등록
- 상태 변경
- 삭제

실제 YAML 파일을 GitHub에 반영하는 곳은 아니고, 페이지에서 보여줄 목록과 상태를 관리한다.

### `policy/apply.ts`

이 파일은 preview 또는 registry에 있는 정책을 기본 브랜치에 반영한다.

- `security/checkov/custom_policies/*.yaml` 경로 검증
- YAML 최소 구조 검증
- GitHub commit 생성

현재 구조는 PR 생성이 아니라 기본 브랜치 직접 커밋이다.

### `policy/remove.ts`

이 파일은 정책 비활성화 또는 삭제 시 GitHub 쪽 YAML 파일을 제거한다.

- 기본 브랜치에 파일이 있는지 확인
- 있으면 delete commit 생성
- 없으면 registry 정리만 진행

### `github/app.ts`

이 파일은 GitHub App 인증 계층이다.

- repository installation 조회
- installation token 기반 Octokit 생성

브라우저가 직접 GitHub를 건드리지 않고 서버가 대신 커밋하는 구조를 가능하게 한다.

### `github/changes.ts`

이 파일은 Git Data API를 이용해 기본 브랜치에 파일을 커밋하거나 삭제한다.

핵심 순서는 다음과 같다.

1. 기본 브랜치 ref 조회
2. base commit 조회
3. blob/tree 생성
4. commit 생성
5. ref 업데이트

즉 apply/remove가 실제 저장소 수정을 할 수 있는 기반 유틸리티다.

## 파일을 분리하면 어떻게 되는가

현재는 `policy/generate.ts` 한 파일에 정책 생성의 거의 모든 책임이 들어 있다. 기능은 맞지만, 테스트와 유지보수 관점에서는 아래처럼 논리적으로 분리하는 것이 더 낫다.

### `parser.ts`

- PDF 텍스트 추출
- source policy 분리
- 섹션 추출

현재 `generate.ts` 안의 `extractSourcePolicies()`, `extractPolicySections()`가 이 역할이다.

### `classifier.ts`

- signal 추출
- check dimension 결정
- `NormalizedControl` 생성
- `terraform_applicability`와 `coverage_mode` 판정
- `allowed_evidence_fields`, `forbidden_inferred_evidence`, `required_resource_families` 계산

현재 `extractPolicySignals()`, `buildNormalizedControl()`, `classifySourcePolicyLocally()`가 이 역할이다.

### `policy-generator.ts`

- system prompt
- user prompt
- 정책 패키지 생성 요청
- 생성 응답 파싱

현재 `buildPolicyDefinitionSystemPrompt()`, `buildPolicyUserPrompt()`, `requestPolicyPackage()`가 이 역할이다.

### `validator.ts`

- package schema 검사
- severity mismatch 검사
- invented tag 검사
- hardcoded resource name 검사
- tautology 검사
- resource family 검사

현재 `validatePolicyPackage()`와 관련 helper가 이 역할이다.

### `repair.ts`

- repair system prompt
- repair user prompt
- validator 실패 후 1회 재시도

현재 `buildPolicyRepairSystemPrompt()`와 repair 호출 구간이 이 역할이다.

### `generate.ts`

- 위 모듈들을 조합하는 오케스트레이터만 남는다.
- `generatePolicyFromPdf()`와 최종 preview 응답 조립이 중심이 된다.

이렇게 나누면 좋은 점은 분명하다.

- parser만 따로 테스트 가능
- classifier 결과만 fixture로 검증 가능
- validator를 독립적으로 강화 가능
- 프롬프트를 바꿔도 PDF 파서를 건드릴 필요가 없음
- LLM provider를 바꿔도 generator 레이어만 수정하면 됨

## 발표할 때 이렇게 설명하면 된다

짧게 설명하면 이 페이지는 "PDF를 곧바로 AI에 던지는 화면"이 아니다.

먼저 서버가 PDF를 읽고 통제 항목을 구조화한 뒤, `NormalizedControl`이라는 압축 JSON으로 바꾼다. 그 다음에만 LLM이 들어가고, 생성된 YAML은 validator와 repair를 거쳐 통과한 것만 preview와 GitHub 반영 대상으로 사용된다. 그래서 이 페이지의 핵심은 단순 AI 호출이 아니라 `파싱 -> 정규화 -> 생성 -> 검증 -> 반영`을 하나의 운영 흐름으로 묶은 점에 있다.
