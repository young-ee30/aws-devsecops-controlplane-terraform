# Policy Page README

이 문서는 `/policy` 페이지가 현재 저장소에서 실제로 어떻게 동작하는지, 어떤 기술이 연결되어 있는지, 어떤 코드가 핵심인지 설명하는 구현 가이드다. 문서 설명은 현재 코드 기준이며, 화면 문구나 타입 이름에 남아 있는 예전 PR/fallback 표현과 실제 백엔드 동작이 다른 부분도 같이 정리한다.

## 1. 이 페이지가 하는 일

정책 페이지는 PDF 형태의 보안 점검 기준서나 가이드를 업로드하면, 그 안의 항목을 읽어 Terraform AWS용 Checkov custom policy YAML로 변환하고, 결과를 미리 본 뒤 정책 목록에 저장하거나 GitHub 저장소에 반영하는 화면이다.

현재 기준 사용자 흐름은 아래와 같다.

1. 사용자가 PDF를 업로드한다.
2. 백엔드가 PDF 텍스트를 추출하고 항목별로 분리한다.
3. 항목별로 Gemini에 정의 생성 요청을 보내 Checkov YAML 초안을 만든다.
4. 프론트가 생성 결과를 preview로 보여 준다.
5. 사용자가 정책을 registry에 저장한다.
6. 저장된 정책을 활성화하면 GitHub 저장소의 기본 브랜치에 YAML 파일이 직접 커밋된다.
7. 비활성화하거나 삭제하면 GitHub 기본 브랜치에서 해당 YAML 파일이 직접 삭제된다.

## 2. 전체 아키텍처

```text
Browser
  -> controlplane/web/src/pages/PolicyPage.tsx
  -> /api/policies/*
     -> controlplane/api/src/routes/policy.ts
        -> generate.ts   # PDF -> source policy -> Gemini -> YAML preview
        -> registry.ts   # 로컬 정책 저장소(JSON)
        -> apply.ts      # GitHub 기본 브랜치로 파일 커밋
        -> remove.ts     # GitHub 기본 브랜치에서 파일 삭제
        -> github/app.ts
        -> github/changes.ts
        -> llm/client.ts # Gemini API 호출
  -> GitHub repository
     -> security/checkov/custom_policies/*.yaml
```

핵심 포인트는 두 가지다.

- 프론트는 GitHub나 Gemini를 직접 호출하지 않는다. 모든 외부 연동은 `controlplane/api`가 담당한다.
- 정책 페이지의 GitHub 반영은 현재 PR 생성 방식이 아니라 기본 브랜치 직접 커밋 방식이다.

## 3. 기술 스택

- 프론트엔드: React + TypeScript + Vite
- UI 아이콘: `lucide-react`
- 백엔드: Express + TypeScript
- PDF 파싱: `pdf-parse`
- AI: Google Gemini Generative Language API
- GitHub 연동: GitHub App + installation token + Octokit
- 정책 저장소: 로컬 JSON 파일
- 정책 포맷: Checkov custom policy YAML
- 타깃 인프라: Terraform AWS

## 4. 핵심 파일과 역할

- `controlplane/web/src/pages/PolicyPage.tsx`
  정책 페이지 전체 UI와 상태 관리. 업로드, preview, registry 저장, 활성화, 비활성화, 삭제를 모두 여기서 제어한다.
- `controlplane/web/src/data/mockData.ts`
  `PolicyTemplate`, `PolicyStatus` 같은 프론트 공통 타입의 기반을 제공한다.
- `controlplane/api/src/routes/policy.ts`
  정책 관련 모든 HTTP 엔드포인트를 정의한다.
- `controlplane/api/src/policy/generate.ts`
  PDF 텍스트 추출, source policy 분리, 섹션/시그널 추출, Gemini 호출, YAML 직렬화를 담당한다.
- `controlplane/api/src/policy/apply.ts`
  생성한 YAML을 GitHub 저장소에 반영한다. 현재는 PR이 아니라 기본 브랜치 직접 커밋이다.
- `controlplane/api/src/policy/remove.ts`
  활성 정책을 비활성화하거나 삭제할 때 GitHub 기본 브랜치에서 파일을 지운다.
- `controlplane/api/src/policy/registry.ts`
  정책 목록을 `policy-registry.json` 파일에 저장한다.
- `controlplane/api/src/github/app.ts`
  GitHub App private key를 로드하고 installation token 기반 Octokit 클라이언트를 만든다.
- `controlplane/api/src/github/changes.ts`
  GitHub blob/tree/commit/ref 업데이트와 PR 생성 유틸리티를 제공한다.
- `controlplane/api/src/llm/client.ts`
  Gemini 모델 이름 정규화, HTTP 호출, 응답 파싱을 담당한다.
- `controlplane/api/src/config/env.ts`
  GitHub App, LLM, CORS 관련 환경 변수를 로드한다.
- `controlplane/api/.env.example`
  로컬 실행용 예시 환경 변수 파일이다. 다만 여기의 LLM 모델 예시는 현재 런타임 구현과 어긋난다.

## 5. 프론트엔드 구현

### 5.1 페이지 진입 시 동작

`PolicyPage.tsx`는 마운트되면 `GET /api/policies/registry`를 호출해 저장된 정책 목록을 불러온다.

- registry 응답은 `policies` 배열이다.
- 프론트는 이를 `StoredPolicy[]` 상태로 관리한다.
- 이 상태가 오른쪽 정책 목록 카드의 데이터 소스가 된다.

### 5.2 PDF 업로드와 분석

업로드 UI는 `PolicyUploadCard`가 담당한다.

- `handleFile()`이 파일 확장자가 `.pdf`인지 먼저 확인한다.
- `fileToBase64()`가 브라우저에서 파일을 base64로 인코딩한다.
- `analyzeFile()`이 `/api/policies/generate`로 아래 payload를 보낸다.

```json
{
  "fileName": "kisa-policy.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "JVBERi0xLjcK..."
}
```

응답이 오면 preview 상태를 저장하고 첫 번째 정책을 기본 오픈 상태로 보여 준다.

### 5.3 Preview에서 현재 실제로 보이는 기능

preview 정책 카드에서 현재 보이는 액션은 아래 3개다.

- YAML 보기/닫기
- YAML 복사
- 정책 목록 추가

즉, 현재 사용자 입장에서 보이는 주 흐름은 "PDF 분석 -> preview 확인 -> 정책 목록 저장"이다.

### 5.4 코드에는 있지만 현재 숨겨진 기능

`PolicyUploadCard` 안에는 아래 기능이 코드상 존재하지만 `className="hidden"` 처리되어 있다.

- preview 전체 YAML 복사
- preview 전체를 GitHub에 일괄 적용
- preview 전체를 정책 목록에 일괄 추가
- PR 결과 배너

또한 프론트 타입에는 `ApplyPullRequest`, `pullRequest`, `mode: 'fallback'` 같은 이름이 남아 있지만, 현재 백엔드 정책 플로우는 이 값들을 실사용하지 않는다.

### 5.5 Registry 저장 방식

preview에서 "정책 목록 추가"를 누르면 `handleCreatePolicy()`가 실행된다.

- `buildStoredPolicy()`가 프론트용 정책 객체를 만든다.
- 기본 상태는 `draft`다.
- `POST /api/policies/registry`로 저장한다.
- 저장 후 오른쪽 정책 목록에 즉시 반영한다.

정책 하나씩 저장할 수도 있고, 숨겨진 bulk create 코드도 남아 있지만 현재 화면에서는 개별 저장이 실제 사용 흐름이다.

### 5.6 정책 활성화/비활성화

오른쪽 `PolicyList`에서 정책 상태 토글 버튼을 누르면 `handleTogglePolicyStatus()`가 실행된다.

- 현재 상태가 `active`면 `POST /api/policies/deactivate`
- 현재 상태가 `draft` 또는 `paused`면 `POST /api/policies/apply`

성공하면 프론트는 상태를 아래처럼 바꾼다.

- `draft` 또는 `paused` -> `active`
- `active` -> `paused`

여기서 중요한 점은 "활성화 = PR 생성"이 아니라 "활성화 = 기본 브랜치 직접 커밋"이라는 것이다.

### 5.7 정책 삭제

정책 삭제는 `handleDeletePolicy()`가 담당한다.

- 먼저 confirm 창을 띄운다.
- confirm 문구에 "기본 브랜치에서 바로 삭제됩니다"라는 설명이 이미 들어 있다.
- `DELETE /api/policies/registry/:id`를 호출한다.
- 백엔드는 GitHub 파일 삭제 후 registry에서도 제거한다.

즉, 삭제는 단순히 목록에서만 지우는 것이 아니라 GitHub 저장소의 정책 파일도 지우는 동작이다.

## 6. 백엔드 API

정책 관련 엔드포인트는 `controlplane/api/src/routes/policy.ts`에 정의되어 있다.

| Endpoint | Method | 실제 역할 |
| --- | --- | --- |
| `/api/policies/registry` | `GET` | 현재 registry에 저장된 정책 목록 조회 |
| `/api/policies/registry` | `POST` | registry에 정책 저장 |
| `/api/policies/registry/:id` | `PATCH` | status, lastUpdated, appliedPullRequest 수정 |
| `/api/policies/registry/:id` | `DELETE` | registry 삭제 + GitHub 파일 삭제 시도 |
| `/api/policies/generate` | `POST` | PDF를 분석해 Checkov YAML preview 생성 |
| `/api/policies/apply` | `POST` | YAML 파일을 GitHub 기본 브랜치에 직접 커밋 |
| `/api/policies/deactivate` | `POST` | GitHub 기본 브랜치에서 YAML 파일 삭제 |

`/api/policies/apply`는 두 가지 입력 형태를 모두 허용한다.

- `policies` 배열
- 또는 단일 `policyPath`, `yaml` 필드

라우터가 내부적으로 이를 배열 형태로 정규화해서 `applyPolicyworkflow()`에 넘긴다.

## 7. PDF -> Checkov YAML 생성 파이프라인

정책 생성 핵심 로직은 `controlplane/api/src/policy/generate.ts`에 있다.

### 7.1 입력 검증

`generatePolicyFromPdf()`는 먼저 아래를 확인한다.

- `fileName` 존재 여부
- `contentBase64` 존재 여부
- `mimeType === application/pdf`
- 파일명이 `.pdf`로 끝나는지
- base64 디코딩 가능 여부
- PDF에 읽을 수 있는 텍스트가 있는지

### 7.2 PDF 텍스트 추출

`extractPdfText()`는 `pdf-parse`의 `PDFParse`를 사용한다.

처리 순서는 아래와 같다.

1. base64를 `Buffer`로 변환
2. `PDFParse({ data: buffer })`
3. `parser.getText()`
4. 공백 정리

현재 구현에는 OCR이 없다. 따라서 스캔 이미지 기반 PDF나 텍스트 레이어가 없는 PDF는 실패할 수 있다.

### 7.3 source policy 항목 분리

`extractSourcePolicies()`는 PDF 텍스트를 여러 개의 source policy 항목으로 분리한다.

우선순위는 아래와 같다.

1. 헤딩 기반 분리
   `CA-07`, `CA 07`, `CA_07`, `1. CA-07 설명` 같은 패턴을 잡는다.
2. 본문 regex fallback
   본문 전체에서 `AA-00` 패턴을 다시 찾는다.
3. 최후 fallback
   아무 ID도 못 찾으면 문서 전체를 `POLICY-1` 한 건으로 본다.

이 단계의 목표는 "PDF 전체"를 한 번에 AI에 던지지 않고, 항목 단위로 잘라서 변환하는 것이다.

### 7.4 섹션 추출

`extractPolicySections()`는 항목 본문에서 아래 구조를 추출한다.

- `purpose`
- `inspectionCriteria`
- `risk`
- `remediation`
- `excerpt`

한국어/영문 라벨을 섞어서 찾고, 라벨이 없더라도 일부 텍스트를 잘라 힌트로 사용한다.

### 7.5 시그널 추출

`extractPolicySignals()`는 Terraform AWS 변환 가능성을 높이기 위한 힌트를 만든다.

- `likelyConvertible`
- `candidateProviders`
- `candidateResourceTypes`
- `matchedTopics`

예를 들어 아래 같은 키워드에서 힌트를 만든다.

- `security group`, `ingress`, `0.0.0.0/0`
- `s3`, `bucket`
- `rds`, `database`
- `kms`
- `cloudtrail`, `logging`
- `route table`, `internet gateway`

이 시그널은 Gemini에게 넘기는 입력을 더 구조화하는 역할을 한다.

### 7.6 로컬 분류와 baseline draft

`classifySourcePolicyLocally()`는 항목이 코드 정책으로 변환 가능한지 1차 판단한다.

- 사람이 해야 하는 절차성 정책인지
- 주기 점검, 교육, 운영 절차 같은 항목인지
- Terraform 리소스 타입으로 표현 가능한지

이 단계에서 변환 가능성이 낮으면 아예 skip 후보가 된다. 반대로 변환 가능성이 높으면 fallback 성격의 baseline draft를 만들고, 이를 Gemini 프롬프트의 힌트로 사용한다.

### 7.7 Gemini 호출

AI 호출 진입점은 `generateWithLlm()`이다.

한 source policy마다 아래 순서로 시도한다.

1. 일반 definition 생성 프롬프트
2. 실패 시 minimal definition 프롬프트

Gemini에 넘기는 입력은 "PDF 전문"이 아니라 아래 같은 구조화 JSON이다.

```json
{
  "sourcePolicyId": "CA-07",
  "sourcePolicyTitle": "Extracted Policy CA-07",
  "sections": {
    "purpose": "...",
    "inspectionCriteria": "...",
    "risk": "...",
    "remediation": "...",
    "excerpt": "..."
  },
  "signals": {
    "likelyConvertible": true,
    "candidateProviders": ["aws"],
    "candidateResourceTypes": ["aws_route_table", "aws_route", "aws_subnet"],
    "matchedTopics": ["route-table"]
  }
}
```

이 설계의 의도는 LLM이 문서 전체를 해석하는 부담을 줄이고, "이미 추출된 보안 항목을 Terraform AWS Checkov rule로 바꾸는 작업"에 집중시키는 것이다.

### 7.8 Gemini 응답 검증

Gemini 응답은 바로 믿지 않고 서버에서 검증한다.

- JSON 파싱 가능해야 한다.
- `definition`이 객체여야 한다.
- `definition` 안에 최소 하나 이상의 `aws_*` Terraform `resource_types`가 있어야 한다.

이 조건을 통과하지 못하면 해당 항목은 최종 정책으로 채택되지 않는다.

### 7.9 YAML 직렬화

최종 draft가 확정되면 `buildCustomPolicyYaml()`이 Checkov YAML 문자열을 만든다.

구조는 아래와 같다.

```yaml
metadata:
  id: CKV2_CUSTOM_...
  name: ...
  category: ...
  severity: ...
  guideline: ...
scope:
  provider: aws
definition:
  ...
```

파일 경로는 항상 아래 패턴으로 내려간다.

```text
security/checkov/custom_policies/<generated-file>.yaml
```

## 8. AI 연동 상세

AI 클라이언트는 `controlplane/api/src/llm/client.ts`에 있다.

### 8.1 실제 provider

현재 런타임에서 지원하는 provider 타입은 사실상 하나뿐이다.

- `LlmProvider = 'gemini'`
- `resolveProvider()`도 항상 `'gemini'`를 반환한다.
- 실제 HTTP 호출도 Google Generative Language API `generateContent` 엔드포인트로 간다.

즉, 정책 페이지의 AI 연동은 현재 Gemini 전용 구현이다.

### 8.2 환경 변수 해석

`env.ts` 기준 LLM 관련 해석은 아래와 같다.

- `GEMINI_API_KEY` 또는 `LLM_API_KEY`
- `GEMINI_MODEL` 또는 `LLM_MODEL`
- 기본 모델 fallback은 `gemini-2.5-flash-lite`

주의할 점:

- `controlplane/api/.env.example`에는 `LLM_MODEL=gpt-5.4-mini`가 적혀 있다.
- 하지만 실제 `llm/client.ts`는 OpenAI를 호출하지 않고 Gemini만 호출한다.

즉, 예시 env의 모델 이름과 실제 런타임 구현이 현재 불일치한다.

### 8.3 프롬프트 설계

정책 생성 프롬프트의 핵심 제약은 아래와 같다.

- Terraform AWS Checkov policy만 생성
- `aws_*` resource type이 없는 규칙은 허용하지 않음
- 운영 절차나 사람 중심 정책은 `not_convertible`로 보냄
- 가능한 단순한 attribute rule 선호
- markdown 없이 JSON만 반환

이 제약 덕분에 "문장 요약"보다 "실제로 Checkov가 해석할 수 있는 rule object 생성"에 더 집중하게 되어 있다.

### 8.4 현재 fallback의 실제 의미

코드에는 `fallback` 타입과 템플릿이 남아 있다. 하지만 현재 공개 응답 흐름은 사실상 Gemini 성공 결과만 `policies`에 담는다.

- Gemini 성공: `policies`에 포함
- Gemini 실패: `skippedPolicies`로 빠짐

즉, 이름만 보면 fallback까지 완전히 동작하는 것처럼 보이지만, 현재 최종 응답은 실질적으로 "Gemini 성공분만 반환"에 가깝다.

## 9. GitHub 연동 상세

### 9.1 GitHub App 인증

`controlplane/api/src/github/app.ts`가 GitHub App 초기화를 담당한다.

- `GITHUB_APP_PRIVATE_KEY`는 PEM 문자열 자체이거나 `.pem` 파일 경로일 수 있다.
- `normalizePrivateKey()`가 개행과 파일 경로를 정리한다.
- `GET /repos/{owner}/{repo}/installation`로 installation을 찾는다.
- `githubApp.getInstallationOctokit()`으로 installation token 기반 Octokit을 만든다.

이 구조 덕분에 프론트가 GitHub 토큰을 직접 들고 있지 않아도 된다.

### 9.2 apply가 실제로 하는 일

`controlplane/api/src/policy/apply.ts`는 `commitFilesToDefaultBranch()`를 호출한다.

이 함수는 내부적으로 아래 순서로 동작한다.

1. 기본 브랜치 ref 조회
2. 현재 commit 조회
3. blob 생성
4. tree 생성
5. commit 생성
6. `heads/<default_branch>` ref를 새 commit으로 업데이트

즉, 정책 활성화는 PR 생성이 아니라 기본 브랜치 ref 업데이트다.

반환값도 실제로는 아래 정도만 준다.

```json
{
  "ok": true,
  "policyPaths": ["security/checkov/custom_policies/example.yaml"],
  "fileCount": 1,
  "branchName": "main",
  "commitSha": "abc123..."
}
```

`branchName`은 별도 작업 브랜치가 아니라 실제로 커밋된 브랜치 이름이다. 보통 저장소 기본 브랜치와 같다.

### 9.3 remove가 실제로 하는 일

`controlplane/api/src/policy/remove.ts`도 동일하게 `commitFilesToDefaultBranch()`를 쓴다.

동작 순서는 아래와 같다.

1. registry에 저장된 `policyPath` 검증
2. GitHub 기본 브랜치에 파일이 실제로 있는지 조회
3. 있으면 delete tree entry로 새 commit 생성
4. 기본 브랜치 ref 업데이트
5. 없으면 GitHub 삭제 없이 registry 삭제만 성공 처리

즉, 비활성화와 삭제 모두 기본 브랜치 직접 삭제 기반이다.

### 9.4 PR 유틸은 있지만 정책 플로우에서는 미사용

`controlplane/api/src/github/changes.ts`에는 `createPullRequestFromFiles()`도 구현돼 있다.

하지만 현재 정책 페이지는 이 함수를 쓰지 않는다. 따라서 문서나 프론트 타입에 `pullRequest`가 남아 있어도 실제 정책 페이지의 GitHub 반영은 PR 기반이 아니다.

## 10. Registry 구조

registry는 `controlplane/api/src/policy/registry.ts`에서 관리한다.

저장 위치는 아래 계산식으로 정해진다.

```ts
path.resolve(process.cwd(), "data", "policy-registry.json")
```

보통 API를 `controlplane/api` 기준으로 실행하므로 실제 파일은 아래 경로가 된다.

```text
controlplane/api/data/policy-registry.json
```

저장 필드는 아래가 핵심이다.

- `id`
- `name`
- `description`
- `source`
- `status`
- `yaml`
- `policyPath`
- `provider`
- `policyId`
- `category`
- `severity`
- `targetProvider`
- `appliedPullRequest`
- `sourcePolicyId`
- `sourcePolicyTitle`

상태 값 의미는 아래와 같다.

- `draft`: registry에만 저장되고 GitHub에는 아직 반영되지 않음
- `active`: GitHub 저장소에 현재 policy 파일이 존재한다고 간주
- `paused`: registry에는 남아 있지만 GitHub에서는 제거된 상태

중요한 구현 포인트:

- 중복 방지는 `id` 기준만 한다.
- 같은 `policyPath`나 같은 `policyId`라도 다른 `id`로 여러 번 저장될 수 있다.
- 따라서 동일 PDF를 여러 번 생성하면 registry 중복이 생길 수 있다.

## 11. 주요 요청/응답 예시

### 11.1 정책 생성 요청

```json
POST /api/policies/generate
{
  "fileName": "kisa-network-guide.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "JVBERi0xLjcK..."
}
```

### 11.2 정책 생성 응답

```json
{
  "ok": true,
  "mode": "llm",
  "provider": "gemini",
  "attemptedProvider": "gemini",
  "fileName": "kisa-network-guide.pdf",
  "summary": "Generated 2 Checkov custom policies from KISA network guide.",
  "policyCount": 2,
  "policies": [
    {
      "sourcePolicyId": "CA-07",
      "sourcePolicyTitle": "Private route table control",
      "policyName": "Ensure private route tables do not route to an Internet Gateway",
      "description": "Require private route tables to avoid direct Internet Gateway routes.",
      "summary": "Derived a networking control from the uploaded guidance.",
      "category": "NETWORKING",
      "severity": "HIGH",
      "targetProvider": "aws",
      "policyId": "CKV2_CUSTOM_CA_07",
      "policyPath": "security/checkov/custom_policies/ca-07-private-route-table.yaml",
      "yaml": "---\nmetadata:\n  ..."
    }
  ],
  "skippedPolicies": []
}
```

### 11.3 정책 활성화 요청

```json
POST /api/policies/apply
{
  "policies": [
    {
      "policyPath": "security/checkov/custom_policies/ca-07-private-route-table.yaml",
      "yaml": "---\nmetadata:\n  ...",
      "policyName": "Ensure private route tables do not route to an Internet Gateway",
      "summary": "Derived a networking control from the uploaded guidance."
    }
  ]
}
```

### 11.4 정책 활성화 응답

```json
{
  "ok": true,
  "policyPaths": ["security/checkov/custom_policies/ca-07-private-route-table.yaml"],
  "fileCount": 1,
  "branchName": "main",
  "commitSha": "abc123def456"
}
```

### 11.5 비활성화/삭제 응답

```json
{
  "ok": true,
  "deleted": true,
  "githubFileDeleted": true,
  "branchName": "main",
  "commitSha": "def456abc123"
}
```

`githubFileDeleted: false`면 registry에서는 삭제되었지만 GitHub 기본 브랜치에는 원래 파일이 없어서 실제 삭제 커밋은 발생하지 않았다는 뜻이다.

## 12. 이 페이지를 설명할 때 핵심 메시지

발표나 데모에서 아래 흐름으로 설명하면 된다.

1. 프론트는 PDF 업로드와 결과 preview를 담당한다.
2. 백엔드는 PDF 파싱, 정책 항목 분리, AI 호출, YAML 생성, GitHub 반영을 모두 담당한다.
3. AI에는 PDF 전체가 아니라 항목별 구조화 입력을 전달한다.
4. AI 출력은 서버에서 `aws_* resource_types`까지 검증한 뒤에만 채택한다.
5. 저장된 정책은 registry에 남고, 활성화 시 GitHub 저장소에 실제 Checkov custom policy 파일이 생긴다.
6. 현재 정책 페이지의 GitHub 반영은 PR이 아니라 기본 브랜치 직접 커밋이다.

짧게 요약하면 아래 한 문장으로도 설명할 수 있다.

> 정책 페이지는 PDF 기반 보안 가이드를 Terraform AWS용 Checkov 정책 파일로 바꿔서, 검토 후 registry에 저장하고 GitHub 저장소에 반영하는 백엔드 주도형 생성/배포 화면이다.

## 13. 현재 구현의 한계와 주의점

- 정책 활성화와 삭제가 기본 브랜치 직접 커밋이다. 승인용 PR 워크플로우가 아니다.
- 프론트 타입과 숨겨진 UI에는 여전히 `pullRequest`, `fallback`, `PR 생성` 표현이 남아 있다.
- `.env.example`의 `LLM_MODEL=gpt-5.4-mini`는 현재 런타임 구현과 맞지 않는다. 실제 코드는 Gemini만 호출한다.
- OCR이 없어서 이미지 기반 PDF는 잘 안 된다.
- registry가 로컬 JSON 파일이라 서버 인스턴스 간 공유나 다중 사용자 동기화에 약하다.
- registry 중복 방지가 `id` 기준뿐이라 동일 정책을 여러 번 저장할 수 있다.
- `handleTogglePolicyStatus()`는 apply 응답의 PR 정보를 저장하도록 설계된 흔적이 있지만, 현재 백엔드 응답과는 맞지 않는다.
- bulk apply/create UI는 코드상 존재하지만 실제 화면에서는 숨겨져 있다.

## 14. 다음 개선 포인트

- `apply.ts`, `remove.ts`를 `createPullRequestFromFiles()` 기반으로 바꿔 PR 승인 플로우로 전환
- 숨겨진 bulk apply UI를 실제 백엔드 동작과 맞게 정리
- registry를 DynamoDB 같은 외부 저장소로 이전
- `policyPath` 또는 `policyId` 기준 중복 방지 추가
- OCR 또는 문서 전처리 계층 추가
- provider 추상화를 실제 구현과 맞추거나 Gemini 전용임을 명확히 정리

## 15. 구현을 다시 해야 한다면 어디부터 보면 되는가

작업 목적별로 보면 아래 순서가 가장 빠르다.

- 화면 동작 이해:
  `controlplane/web/src/pages/PolicyPage.tsx`
- API 입출력 이해:
  `controlplane/api/src/routes/policy.ts`
- PDF -> YAML 변환 이해:
  `controlplane/api/src/policy/generate.ts`
- GitHub 반영 방식 이해:
  `controlplane/api/src/policy/apply.ts`
  `controlplane/api/src/policy/remove.ts`
  `controlplane/api/src/github/changes.ts`
- GitHub App 인증 이해:
  `controlplane/api/src/github/app.ts`
- AI 설정 이해:
  `controlplane/api/src/llm/client.ts`
  `controlplane/api/src/config/env.ts`

이 순서대로 보면 정책 페이지를 기술적으로 설명하거나, 같은 구조를 다시 구현하거나, PR 기반으로 개편하는 작업까지 이어서 진행할 수 있다.
