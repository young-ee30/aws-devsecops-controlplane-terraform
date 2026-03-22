# GitHub Actions Log Page README

## 1. 이 문서의 목적

이 문서는 `controlplane/web/src/pages/GitActionsPage.tsx` 기반의 GitHub Actions 로그 페이지를 직접 설명하고, 같은 구조를 다시 구현할 수 있게 만드는 기술 문서다.

설명 대상은 다음 전체 흐름이다.

1. 대시보드에서 GitHub App 연결 상태 확인
2. 최근 GitHub Actions run 목록 조회
3. 선택한 run의 job, step, 로그, annotation, 요약 조회
4. 전체 파이프라인 실행 또는 재실행
5. 실패 로그를 rule-based + LLM으로 분석
6. AI 제안 파일을 새 브랜치와 PR로 생성
7. PR 머지 또는 닫기

짧게 설명하면 이 페이지는 "GitHub Actions 관제 화면 + 실패 원인 분석기 + AI 수정 제안기 + PR 생성기"다.

## 2. 페이지가 실제로 하는 일

라우트는 `controlplane/web/src/App.tsx`에서 `/git-actions`로 연결된다.

```tsx
<Route path="git-actions" element={<GitActionsPage />} />
```

이 페이지는 단순 로그 뷰어가 아니다. 아래 기능이 한 화면에 모여 있다.

- GitHub App 연결 확인
- 3개 핵심 workflow 체인 상태 표시
- run별 job/step 타임라인 시각화
- 실패 로그 복사
- run 전체 재실행
- 실패 job만 재실행
- AI 원인 분석
- AI가 제안한 파일로 PR 생성
- 생성된 PR 머지/닫기

## 3. 구현에 필요한 기술 스택

| 영역 | 현재 사용 기술 | 역할 |
| --- | --- | --- |
| 프론트엔드 | React 18, TypeScript, Vite, React Router | 페이지 렌더링, 라우팅, 상태 관리 |
| UI | Tailwind 계열 클래스, lucide-react | 상태 배지, 로그 카드, 타임라인 UI |
| 백엔드 | Node.js, Express 4, TypeScript | GitHub API 중계, AI 분석, PR 생성 |
| GitHub 연동 | GitHub App + Octokit | installation token 발급, Actions/PR/Contents API 호출 |
| 로그 수집 | GitHub REST API + redirect log download | job 로그 텍스트 다운로드 |
| AI 분석 | rule-based analyzer + LLM adapter | 실패 원인 설명, 수정안 생성 |
| 코드 반영 | Git blobs / trees / commits / pulls API | 브랜치 생성, 커밋, PR 생성 |
| 갱신 방식 | polling | 실시간 대신 주기적 새로고침 |

중요한 설계 원칙은 아래와 같다.

- 브라우저는 GitHub를 직접 호출하지 않는다.
- GitHub 제어는 모두 `controlplane/api`가 수행한다.
- 인증은 PAT가 아니라 GitHub App installation token을 쓴다.
- AI 수정은 `main` 직접 push가 아니라 `branch -> commit -> PR` 흐름으로 처리한다.

## 4. 관련 파일 맵

### 프론트엔드

| 파일 | 역할 |
| --- | --- |
| `controlplane/web/src/App.tsx` | `/git-actions` 라우트 연결 |
| `controlplane/web/src/pages/GitActionsPage.tsx` | 페이지 전체 상태와 액션 핸들러 |
| `controlplane/web/src/components/pipeline/PipelineGraph.tsx` | workflow/job 단위 파이프라인 그래프 |
| `controlplane/web/src/components/pipeline/StepTimeline.tsx` | job 내부 step 타임라인 |
| `controlplane/web/src/lib/env.ts` | `VITE_API_BASE_URL` 해석 |
| `controlplane/web/vite.config.ts` | 로컬 개발 시 `/api` 프록시 |

### 백엔드

| 파일 | 역할 |
| --- | --- |
| `controlplane/api/src/server.ts` | Express 앱 부팅, CORS, 라우터 연결 |
| `controlplane/api/src/config/env.ts` | 환경변수 검증 |
| `controlplane/api/src/routes/github.ts` | GitHub 상태, run, logs, rerun, dispatch, PR API |
| `controlplane/api/src/routes/fix.ts` | AI 제안과 confirm(PR 생성) API |
| `controlplane/api/src/github/app.ts` | GitHub App 인증과 installation token 발급 |
| `controlplane/api/src/github/actions.ts` | workflow runs, jobs, logs, annotations, dispatch, rerun |
| `controlplane/api/src/fix/summarize.ts` | run/job/step 요약 문장 생성 |
| `controlplane/api/src/fix/suggest.ts` | 실패 로그 rule-based 분석 + LLM 분석 |
| `controlplane/api/src/github/changes.ts` | 브랜치/커밋/PR 생성 |
| `controlplane/api/src/llm/client.ts` | LLM 호출 어댑터 |

## 5. 전체 요청 흐름

```text
Browser
  -> GitActionsPage.tsx
  -> controlplane/api
       -> GitHub App auth
       -> GitHub REST API
       -> LLM API
       -> Git blobs / trees / commits / pulls API
  -> GitHub Actions / Pull Requests
```

### 페이지 최초 진입

1. `loadStatus()`가 `/api/github/status` 호출
2. `loadRuns()`가 `/api/github/runs` 호출
3. 적절한 기본 run을 선택
4. 선택된 run에 대해 아래를 병렬 로드
   - `/jobs`
   - `/summary`
   - `/logs`
   - `/annotations`

### 사용자가 "전체 실행" 클릭

1. 프론트가 `/api/github/pipeline/run-all` 호출
2. 백엔드가 `bootstrap-terraform-state.yml`에 `workflow_dispatch`
3. 프론트가 새 run이 생길 때까지 짧은 polling
4. 새 run이 감지되면 자동 선택

### 사용자가 "AI 도움 받기" 클릭

1. 프론트가 `/api/github/fix-sessions/:runId/suggest` 호출
2. 백엔드가 jobs + logs 조회
3. rule-based 분류 수행
4. 필요한 경우 LLM 호출
5. 분석 결과와 suggested files 반환

### 사용자가 "적용 (PR 생성)" 클릭

1. 프론트가 `/api/github/fix-sessions/:runId/confirm` 호출
2. 백엔드가 새 branch 생성
3. 파일 blob/tree/commit 생성
4. PR 생성
5. 프론트가 `/api/github/pulls/:prNumber` 재조회

## 6. 프론트엔드 구현 설명

## 6-1. API 진입점과 로컬 프록시

`controlplane/web/src/lib/env.ts`는 프론트가 어디로 API를 보낼지 결정한다.

```ts
const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || ''
export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '')
```

로컬 개발에서는 `VITE_API_BASE_URL`을 비워두고 `controlplane/web/vite.config.ts`의 프록시를 사용한다.

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:4000', changeOrigin: true },
    '/health': { target: 'http://localhost:4000', changeOrigin: true },
  },
}
```

즉, 프론트는 `http://localhost:5173`, API는 `http://localhost:4000`으로 띄우되 브라우저에서는 같은 origin처럼 `/api/...`를 호출한다.

## 6-2. 핵심 상태 설계

`GitActionsPage.tsx`는 아래 상태를 중심으로 동작한다.

- `status`: GitHub App 연결 상태
- `runs`: 최근 workflow run 목록
- `selectedRunId`: 현재 사용자가 보고 있는 run
- `jobs`: 선택한 run의 job/step 정보
- `logs`: 선택한 run에서 가져온 로그 텍스트
- `annotations`: GitHub annotations
- `runSummary`: 사람이 읽기 쉬운 단계 요약
- `suggestion`: AI 분석 결과
- `prReview`: 생성된 PR 상세 정보
- `actionMessage`: 버튼 실행 결과 메시지

이 페이지가 중요한 이유는 "한 번의 선택"으로 여러 비동기 요청이 연쇄적으로 나가므로, stale response 방지가 꼭 필요하다는 점이다.

## 6-3. stale response 방지

이 페이지는 최신 요청만 반영하기 위해 request id ref를 쓴다.

```ts
const latestDetailRequestIdRef = useRef(0)
const selectedRunIdRef = useRef<number | null>(null)
```

예를 들어 `loadRunDetail()`은 이렇게 동작한다.

1. 호출마다 request id 증가
2. 응답이 돌아왔을 때 request id가 최신인지 확인
3. 그 사이 사용자가 다른 run을 선택했으면 응답 무시

이 패턴이 없으면 빠르게 run을 바꿀 때 A run의 응답이 B run 화면을 덮어쓰는 문제가 생긴다.

## 6-4. 폴링 구조

초기 진입 시 전체 run 목록을 15초마다 갱신한다.

```ts
const POLLING_INTERVAL_MS = 15000
```

선택된 run이 있으면 그 run의 상세도 같은 간격으로 갱신한다.

- `loadRunDetail(selectedRunId, true)`
- `loadRunSummary(selectedRunId)`
- `loadRunAnnotations(selectedRunId)`

현재 구조는 webhook 실시간 push가 아니라 polling 기반이다. 구현 난이도는 낮지만 API 호출량은 늘어난다.

## 6-5. workflow run 선택 방식

이 페이지는 모든 run을 그대로 나열하지 않는다. 아래 3개 workflow를 하나의 파이프라인 세션처럼 본다.

- `Bootstrap Terraform State`
- `Terraform Dev Plan and Apply`
- `Deploy Selected Services to ECS`

`getVisibleWorkflowRuns()`는 다음 기준으로 run을 묶는다.

- 같은 브랜치
- 생성 시각 차이가 20분 이내
- 위 3개 workflow 이름과 매칭

즉, 이 페이지는 "raw GitHub run list"가 아니라 "현재 DevSecOps 파이프라인 세션"을 보여주는 화면이다.

## 6-6. 공통 fetch 함수

`apiFetch()`는 이 페이지의 공용 fetch 래퍼다.

이 함수가 하는 일:

- JSON 응답 자동 파싱
- HTML이 오면 API 서버 오작동으로 간주
- `error` 또는 `message` 필드 추출
- non-JSON 응답 방어

이 로직이 필요한 이유는 API 서버가 죽었거나 프록시가 잘못 연결되면 HTML 에러 페이지가 오는 경우가 있기 때문이다.

## 6-7. 주요 사용자 액션 핸들러

### 전체 실행

`handleExecuteworkflow()`는 `/api/github/pipeline/run-all`을 호출한다.

핵심 포인트:

- 현재 선택된 브랜치 또는 기본 브랜치 기준 실행
- 실행 직후 짧은 간격 polling으로 새 run 검색
- 새 run이 감지되면 자동 선택

### 재실행

`handleRerun('all' | 'failed')`는 아래 둘 중 하나를 호출한다.

- `/api/github/runs/:runId/rerun`
- `/api/github/runs/:runId/rerun-failed`

### AI 제안

`handleSuggest()`는 run 단위 분석이고, `handleSuggestAnnotations()`는 특정 job annotation 기반 분석이다.

annotation 기반 분석은 Checkov처럼 파일/라인이 있는 보안 오류에 특히 유용하다.

### PR 생성

`handleApply()`는 `suggestion.suggestedFiles`를 백엔드 confirm API에 넘긴다.

즉, 프론트는 코드를 직접 생성하지 않고 "AI가 제안한 파일 묶음"을 서버에 전달만 한다.

## 6-8. 로그/annotation 표시 방식

이 페이지의 로그 UI는 단순 `<pre>`가 아니다.

### `LogViewer`

- 로그를 줄 단위로 분리
- 타임스탬프 파싱
- `##[error]`, `##[warning]`, `##[group]` 같은 GitHub Actions marker 해석
- indentation 수준 계산
- 에러/경고/커맨드 색상 구분

### `buildAnnotationListItems()`

이 함수는 두 소스를 합친다.

1. GitHub annotation API에서 받은 구조화된 에러
2. 로그 텍스트에서 추출한 terminal error

즉, annotation이 없는 실패라도 최소한 "exit code 1" 같은 terminal error를 UI에 노출한다.

## 6-9. 파이프라인 시각화

### `PipelineGraph.tsx`

이 컴포넌트는 workflow 종류별로 job 구성을 다르게 보여준다.

- bootstrap workflow면 버킷 준비 단계 1개
- terraform workflow면 plan/apply 2단계
- deploy workflow면 resolve target + deploy matrix

실제 job이 아직 없으면 placeholder를 보여준다. 그래서 페이지가 로딩 중이어도 전체 모양은 유지된다.

### `StepTimeline.tsx`

이 컴포넌트는 step별 상태를 아이콘과 요약으로 보여준다.

- 실행 중: 파란색
- 성공: 초록색
- 실패: 빨간색
- 건너뜀: 회색

## 7. 백엔드 구현 설명

## 7-1. 서버 부팅과 라우터 구성

`controlplane/api/src/server.ts`는 Express 앱을 띄우고 다음 라우터를 붙인다.

- `healthRouter`
- `metricsRouter`
- `githubRouter`
- `fixRouter`
- `policyRouter`

핵심은 `githubRouter`와 `fixRouter`다.

```ts
app.use(githubRouter)
app.use(fixRouter)
```

또한 CORS origin은 `FRONTEND_ORIGIN`으로 고정한다. 따라서 로컬에서 프론트를 5173으로 띄우면 API도 같은 origin 설정을 맞춰야 한다.

## 7-2. 환경변수

필수값은 `controlplane/api/src/config/env.ts`에서 검증한다.

### 최소 필수

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
GITHUB_OWNER=young-ee30
GITHUB_REPO=aws-security-project
GITHUB_APP_ID=1234567
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
```

### 선택

```env
GITHUB_WEBHOOK_SECRET=
LLM_API_KEY=
LLM_MODEL=
METRICS_SOURCE_URL=
```

## 7-3. GitHub App 인증

`controlplane/api/src/github/app.ts`는 아래를 처리한다.

1. private key 정규화
2. GitHub App 인스턴스 생성
3. 저장소 installation 조회
4. installation octokit 생성
5. installation token 발급

핵심 함수는 아래 4개다.

- `getRepositoryMetadata()`
- `getInstallationForRepository()`
- `getRepoOctokit()`
- `getInstallationToken()`

특히 `normalizePrivateKey()`는 다음 두 입력을 모두 지원한다.

- PEM 문자열 자체
- `.pem` 파일 절대경로

이 설계 덕분에 로컬 개발과 서버 배포 둘 다 대응할 수 있다.

## 7-4. GitHub 관련 REST API

`controlplane/api/src/routes/github.ts`는 프론트가 쓰는 API 계약을 제공한다.

### 상태/조회

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/api/github/status` | 저장소와 App 연결 상태 |
| `GET` | `/api/github/runs` | 최근 run 목록 |
| `GET` | `/api/github/runs/:runId/jobs` | job/step 목록 |
| `GET` | `/api/github/runs/:runId/logs` | 선택 run 로그 |
| `GET` | `/api/github/runs/:runId/annotations` | annotation 목록 |
| `GET` | `/api/github/runs/:runId/summary` | 사람이 읽기 쉬운 요약 |

### 제어

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/api/github/runs/:runId/rerun` | 전체 run 재실행 |
| `POST` | `/api/github/runs/:runId/rerun-failed` | 실패 job만 재실행 |
| `POST` | `/api/github/pipeline/run-all` | bootstrap workflow부터 전체 체인 실행 |
| `POST` | `/api/github/workflows/:workflowId/dispatch` | 특정 workflow dispatch |

### PR 후처리

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/api/github/pulls/:prNumber` | PR 상세 조회 |
| `POST` | `/api/github/pulls/:prNumber/merge` | squash merge |
| `PATCH` | `/api/github/pulls/:prNumber/close` | PR 닫기 |

## 7-5. workflow run / jobs / logs 수집

이 로직은 `controlplane/api/src/github/actions.ts`에 있다.

### run 목록

`listWorkflowRuns()`는 GitHub REST API `GET /repos/{owner}/{repo}/actions/runs`를 호출해 프론트가 쓰기 쉬운 형태로 정규화한다.

### job 목록

`getWorkflowRunJobs()`는 `GET /actions/runs/{run_id}/jobs`를 호출하고, 각 job에서 `steps[]`까지 꺼낸다.

### 로그 다운로드

여기가 중요한 구현 포인트다.

GitHub job log API는 바로 텍스트를 주지 않고 redirect URL을 준다. 그래서 `fetchJobLogText()`는 2단계로 동작한다.

1. `GET /actions/jobs/{jobId}/logs` with `redirect: 'manual'`
2. 응답 헤더의 `location`으로 실제 텍스트 다운로드

즉, Octokit 한 번으로 끝나는 구조가 아니라 fetch 기반 수동 redirect 처리다.

### 어떤 job 로그를 가져오나

`getWorkflowRunLogs()`는 모든 job 로그를 다 가져오지 않는다. 우선순위는 아래다.

1. 실패한 job
2. 실패한 job이 없으면 진행 중 job 최대 3개
3. 그것도 없으면 앞쪽 job 최대 3개

이 방식은 비용과 응답 시간을 줄이는 대신 "run 전체 raw archive"가 아니라 "지금 중요한 로그"에 집중한다.

## 7-6. annotations

`getWorkflowRunAnnotations()`는 각 job의 `checkRunId`를 추출한 뒤 GitHub check-run annotation API를 호출한다.

구조화된 데이터에는 아래가 포함된다.

- `path`
- `startLine`, `endLine`
- `annotationLevel`
- `message`
- `title`
- `rawDetails`
- `blobHref`

현재 코드에는 `parseCheckovAnnotationsFromLog()` 함수가 정의돼 있지만 실제 fallback 경로로 연결되지는 않았다. 즉, annotation fallback을 더 강화하려면 이 함수를 `getWorkflowRunAnnotations()`에 연결하면 된다.

## 7-7. 사람이 읽기 쉬운 요약

`controlplane/api/src/fix/summarize.ts`는 job/step 이름을 규칙 기반으로 읽어서 자연어 요약을 만든다.

예를 들면:

- `Terraform Plan & Security Scan` -> "인프라 변경 계획"
- `Checkov` -> "IaC 보안 스캔"
- `Terraform Apply` -> "실제 적용"

이 요약은 프론트에서 `StepTimeline`과 run summary badge에 사용된다.

## 8. AI 연동 설명

## 8-1. AI 엔드포인트

`controlplane/api/src/routes/fix.ts`는 두 API를 제공한다.

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/api/github/fix-sessions/:runId/suggest` | 실패 분석과 수정안 생성 |
| `POST` | `/api/github/fix-sessions/:runId/confirm` | suggested files를 PR로 반영 |

## 8-2. suggest 전체 흐름

핵심 함수는 `generateFixSuggestion()`이다.

동작 순서는 다음과 같다.

1. `runId` 숫자 검증
2. jobs 조회
3. logs 조회
4. ANSI 제거와 줄바꿈 정규화
5. annotation 기반인지 일반 로그 기반인지 판단
6. rule-based 분류
7. candidate file 추천
8. 필요하면 Terraform 코드 일부를 추가 컨텍스트로 수집
9. LLM 호출
10. 코드 블록에서 suggested files 추출

## 8-3. rule-based 분석

현재 코드에 들어있는 대표 규칙:

- `terraform-resource-already-managed`
- `terraform-secret-missing`
- `terraform-state-bucket-missing`
- `aws-role-assume-failed`
- `workflow-yaml-invalid`
- `checkov-annotations`
- `generic-failed-run`

즉, LLM 없이도 아래 정보는 만들 수 있다.

- summary
- rootCause
- riskLevel
- nextActions
- candidateFiles

이 구조 덕분에 LLM이 실패해도 페이지는 완전히 망가지지 않는다.

## 8-4. LLM 호출

LLM 호출 코드는 `controlplane/api/src/llm/client.ts`와 `controlplane/api/src/fix/suggest.ts`에 있다.

현재 구현의 실제 동작은 다음과 같다.

- provider는 사실상 `gemini`만 지원
- Google Generative Language API `generateContent` 호출
- system prompt + user prompt 조합

중요한 현재 상태:

- `.env.example`에는 `LLM_MODEL=gpt-5.4-mini`라고 되어 있음
- 하지만 실제 `llm/client.ts`는 Gemini API만 호출함

즉, 현재 코드는 "LLM 변수 이름은 범용처럼 보이지만 실제 구현은 Gemini 전용"이다.

이 부분은 구현 설명 시 반드시 짚어야 한다.

### 발표용 설명

"지금 구조는 LLM provider abstraction을 의도했지만, 현재 adapter 구현은 Gemini 하나만 연결된 상태다. OpenAI를 붙이려면 `callConfiguredLlm()`에 provider 분기를 추가하면 된다."

## 8-5. 프롬프트 구조

`callLlmAnalysis()`는 아래 정보를 prompt에 넣는다.

- rule-based 사전 분석 결과
- annotation 요약
- 잘린 실패 로그
- 관련 Terraform 코드 일부

즉, LLM에게 완전 무지 상태에서 로그를 던지는 것이 아니라, 서버가 1차 구조화를 먼저 한 뒤 컨텍스트를 보강해서 보내는 구조다.

## 8-6. suggested files 파싱

LLM 응답 전체는 `llmAnalysis`로 저장한다. 그리고 `parseSuggestedFiles()`가 코드 블록을 다시 파싱해서 실제 파일 반영용 구조로 바꾼다.

기대 형식:

````text
#### terraform/modules/ecs/main.tf
```hcl
# 전체 수정 코드
```
````

파싱 조건:

- 파일 경로가 있어야 함
- 코드 블록이 너무 짧지 않아야 함
- `.tf` 또는 `.tfvars` 위주로 추출

즉, "설명 텍스트"와 "실제 반영 가능한 파일"은 별도 개념이다.

## 8-7. suggest API 응답에서 꼭 보는 필드

프론트가 실제로 중요하게 쓰는 응답 필드는 아래다.

```json
{
  "ok": true,
  "runId": "123456789",
  "mode": "hybrid",
  "llmStatus": "success",
  "summary": "Terraform apply 전에 orphan import 단계에서 충돌이 발생했습니다.",
  "rootCause": "이미 state에 있는 리소스를 다시 import하려고 했습니다.",
  "riskLevel": "medium",
  "nextActions": [
    "terraform state show 체크 추가",
    "already managed 에러를 skip 처리"
  ],
  "candidateFiles": [
    {
      "path": ".github/workflows/terraform-dev-plan-apply.yml",
      "reason": "import 보정 로직이 들어 있습니다."
    }
  ],
  "llmAnalysis": "긴 자연어 분석 결과",
  "suggestedFiles": [
    {
      "path": "terraform/modules/ecs/main.tf",
      "content": "전체 파일 내용"
    }
  ]
}
```

UI 기준으로 보면:

- `summary`, `rootCause`, `riskLevel`은 사람이 읽는 설명
- `candidateFiles`는 어디를 봐야 하는지 알려주는 힌트
- `suggestedFiles`는 PR 생성에 바로 쓰는 실제 파일 데이터

## 9. PR 생성 설명

`controlplane/api/src/github/changes.ts`가 PR 생성을 담당한다.

## 9-1. 동작 순서

1. base branch 조회
2. 새 branch 이름 예약
3. 각 파일을 Git blob으로 생성
4. 새 tree 생성
5. 새 commit 생성
6. branch ref 업데이트
7. PR 생성

이 방식은 로컬에서 `git clone`을 하지 않고 GitHub Git Data API만으로 커밋을 만든다.

## 9-2. 핵심 함수

- `reserveBranchName()`
- `buildTreeEntries()`
- `createPullRequestFromFiles()`

장점:

- 서버 파일시스템에 repo clone이 필요 없다.
- 구현이 단순하다.
- 사용자 승인 후 바로 PR 생성이 가능하다.

주의점:

- suggestedFiles 내용이 "전체 파일 내용"이어야 한다.
- patch가 아니라 whole-file replacement 방식이다.

## 9-3. confirm API 요청 예시

```json
{
  "files": [
    {
      "path": "terraform/modules/ecs/main.tf",
      "content": "전체 파일 내용"
    }
  ],
  "commitMessage": "ai fix: Terraform 수정 제안 (run #123456789)",
  "prTitle": "AI Fix: run #123456789 에러 수정",
  "prBody": "GitHub Actions run #123456789 실패에 대한 AI 분석 기반 Terraform 코드 수정입니다."
}
```

이 요청이 들어오면 백엔드는 브랜치 생성부터 PR 생성까지 모두 처리한다.

## 10. 로컬에서 실행하는 방법

## 10-1. API 서버

```bash
cd controlplane/api
npm install
npm run dev
```

기본 포트는 `4000`이다.

## 10-2. 웹 서버

```bash
cd controlplane/web
npm install
npm run dev
```

기본 포트는 `5173`이다.

브라우저에서 열 주소:

- 앱: `http://localhost:5173`
- 페이지: `http://localhost:5173/git-actions`

## 10-3. 필요한 환경변수

### `controlplane/api/.env`

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
GITHUB_OWNER=your-owner
GITHUB_REPO=aws-security-project
GITHUB_APP_ID=1234567
GITHUB_APP_PRIVATE_KEY=C:\absolute\path\to\app.pem
GITHUB_WEBHOOK_SECRET=optional
LLM_API_KEY=optional
LLM_MODEL=gemini-2.5-flash-lite
```

### `controlplane/web/.env`

```env
VITE_API_BASE_URL=
VITE_METRICS_URL=
```

로컬에서는 `VITE_API_BASE_URL`을 비워두는 편이 간단하다.

## 11. 구현/발표 시 핵심 설명 포인트

아래 6가지만 정확히 설명할 수 있으면 이 페이지 구조를 거의 다 이해한 것이다.

1. 프론트는 GitHub를 직접 치지 않고 Express API만 호출한다.
2. 백엔드는 GitHub App installation token으로 Actions/PR/Contents API를 호출한다.
3. 로그 조회는 redirect URL을 따라가야 해서 일반 JSON API와 다르다.
4. 실패 분석은 rule-based가 1차, LLM이 2차다.
5. AI 수정은 바로 적용하지 않고 PR 생성으로 끝낸다.
6. 실시간 반영은 webhook이 아니라 polling 중심이다.

## 12. 바로 개선할 수 있는 지점

### 1. OpenAI/GPT 정식 지원

현재는 env 이름이 범용적이지만 실제 구현은 Gemini 전용이다. `llm/client.ts`에 provider 분기를 추가하면 OpenAI도 바로 붙일 수 있다.

### 2. annotation fallback 연결

`parseCheckovAnnotationsFromLog()`를 `getWorkflowRunAnnotations()`에 연결하면 check-run annotation이 없는 경우에도 파일/라인 정보를 더 많이 복구할 수 있다.

### 3. webhook 기반 실시간 갱신

지금은 polling만 쓰므로 지연과 호출량이 있다. GitHub webhook + 서버 push 또는 재조회 트리거를 붙이면 개선된다.

### 4. patch 기반 PR 생성

지금은 whole-file replacement다. diff patch 기반으로 바꾸면 더 안전해진다.

### 5. workflow별 프롬프트 분리

Terraform 실패, Docker 실패, GitHub Actions YAML 실패는 프롬프트를 따로 두는 편이 분석 품질이 좋다.

## 13. 현재 한계와 주의사항

- 이 페이지는 현재 3개 workflow 체인에 최적화되어 있다.
- 모든 job 로그를 다 가져오지 않는다.
- LLM suggested files가 파일 경로를 제대로 주지 않으면 PR 생성이 안 된다.
- PR 생성은 whole-file replacement라 부분 수정에 비해 거칠 수 있다.
- `.env.example`의 LLM 값과 실제 구현 provider가 완전히 일치하지 않는다.

## 14. 함께 읽으면 좋은 문서

- `docs/README.md`
- `docs/github-actions-flow.md`
- `docs/dashboard-local-to-aws-guide.md`
- `docs/controlplane-api-aws-deploy-checklist.md`
