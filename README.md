# aws-security-project

## Repository Tree

> 실제 운영/개발에 중요한 경로만 정리했습니다. `node_modules/`, `.terraform/`, `dist/`, `.env`, `*.log`, `*.db` 같은 생성물과 로컬 런타임 파일은 제외했습니다.

```text
aws-security-project/
├── .github/                                  # GitHub Actions와 재사용 action 정의
│   ├── README.md                             # GitHub Actions 전체 흐름 설명
│   ├── actions/                              # workflow에서 재사용하는 composite action 모음
│   │   └── deploy-ecs-service/
│   │       └── action.yml                    # 단일 ECS 서비스 빌드·스캔·푸시·배포 공통 로직
│   └── workflows/                            # CI/CD와 Terraform 자동화 workflow
│       ├── README.md                         # workflow 폴더 운영 메모
│       ├── bootstrap-terraform-state.yml     # Terraform remote state S3 버킷 준비
│       ├── terraform-dev-plan-apply.yml      # dev 인프라 plan/apply 파이프라인
│       ├── ex-ecs-deploy.yml                 # 변경된 서비스만 골라 ECS에 배포
│       └── pull-request-security-scans.yml   # PR 보안 스캔(Checkov/Trivy/Gitleaks 등)
├── controlplane/                             # 대시보드 웹과 제어용 API
│   ├── README.md                             # control plane 개요와 실행 가이드
│   ├── api/                                  # GitHub/LLM/정책 연동용 Express + TypeScript API
│   │   ├── .env.example                      # API 환경변수 예시
│   │   ├── package.json                      # 의존성과 dev/build/start 스크립트
│   │   ├── tsconfig.json                     # TypeScript 컴파일 설정
│   │   ├── data/
│   │   │   └── policy-registry.json          # 정책 레지스트리 샘플/기본 데이터
│   │   └── src/
│   │       ├── server.ts                     # API 서버 진입점
│   │       ├── config/
│   │       │   └── env.ts                    # 환경변수 로딩과 검증
│   │       ├── github/                       # GitHub App/Actions 조회 로직
│   │       │   ├── app.ts                    # GitHub App 인증/클라이언트 구성
│   │       │   ├── actions.ts                # workflow run 조회·재실행·dispatch 처리
│   │       │   └── changes.ts                # 커밋 변경 파일 분석 유틸
│   │       ├── routes/                       # HTTP 라우트 엔드포인트
│   │       │   ├── health.ts                 # 헬스체크
│   │       │   ├── github.ts                 # GitHub 관련 API
│   │       │   ├── metrics.ts                # 메트릭 조회 API
│   │       │   ├── policy.ts                 # 정책 생성·적용·삭제 API
│   │       │   └── fix.ts                    # 자동 수정 제안/확정 API
│   │       ├── policy/                       # 정책 생성·적용·저장 로직
│   │       │   ├── generate.ts               # 정책 초안 생성
│   │       │   ├── apply.ts                  # 정책 반영 처리
│   │       │   ├── remove.ts                 # 정책 제거 처리
│   │       │   └── registry.ts               # 정책 레지스트리 접근
│   │       ├── fix/                          # 실패 로그 요약과 수정 제안 로직
│   │       │   ├── summarize.ts              # 실패 원인 요약
│   │       │   └── suggest.ts                # 수정안 생성
│   │       └── llm/
│   │           └── client.ts                 # LLM 호출 클라이언트
│   └── web/                                  # 보안/인프라/GitHub 상태 대시보드 프론트엔드
│       ├── .env.example                      # 웹 앱 환경변수 예시
│       ├── package.json                      # Vite 기반 대시보드 의존성
│       ├── vite.config.ts                    # 번들링/개발 서버 설정
│       ├── index.html                        # 브라우저 진입 HTML
│       ├── app/                              # 앱 셸 스타일/레이아웃용 보조 디렉터리
│       │   ├── globals.css                   # 전역 스타일
│       │   └── layout.tsx                    # 공통 레이아웃 컴포넌트
│       ├── components/                       # 재사용 UI 컴포넌트 묶음
│       │   ├── theme-provider.tsx            # 테마 컨텍스트 제공
│       │   └── ui/                           # shadcn 계열 기본 UI 컴포넌트
│       ├── hooks/                            # 공용 커스텀 훅
│       │   ├── use-mobile.ts                 # 모바일 화면 감지
│       │   └── use-toast.ts                  # 토스트 상태 관리
│       ├── lib/
│       │   └── utils.ts                      # 공통 유틸 함수
│       ├── public/                           # 정적 아이콘/플레이스홀더 리소스
│       ├── src/                              # 실제 대시보드 화면 소스
│       │   ├── main.tsx                      # React 앱 마운트 엔트리
│       │   ├── App.tsx                       # 라우팅과 페이지 조합
│       │   ├── index.css                     # 앱 전역 스타일
│       │   ├── pages/                        # 대시보드 각 페이지 화면
│       │   │   ├── AwsResourcePage.tsx       # AWS 리소스 상태 화면
│       │   │   ├── InfraPage.tsx             # 인프라 개요 화면
│       │   │   ├── SecurityPage.tsx          # 보안 상태 화면
│       │   │   ├── GitActionsPage.tsx        # GitHub Actions 실행 현황 화면
│       │   │   ├── PolicyPage.tsx            # 정책 관리 화면
│       │   │   ├── AppHttpPage.tsx           # 애플리케이션 HTTP 지표 화면
│       │   │   ├── CicdPage.tsx              # CI/CD 흐름 화면
│       │   │   ├── GithubCallbackPage.tsx    # GitHub App 콜백 처리 화면
│       │   │   └── GithubInstalledPage.tsx   # GitHub App 설치 완료 화면
│       │   ├── components/                   # 페이지 조립용 시각화 컴포넌트
│       │   │   ├── layout/                   # 헤더/사이드바/레이아웃
│       │   │   ├── common/                   # 공통 카드/배지 컴포넌트
│       │   │   ├── charts/                   # 메트릭 시각화 차트
│       │   │   └── pipeline/                 # 파이프라인 그래프/타임라인
│       │   ├── hooks/
│       │   │   └── useMetrics.ts             # 메트릭 API 조회 훅
│       │   ├── lib/
│       │   │   ├── env.ts                    # 클라이언트 환경변수 접근
│       │   │   ├── parsePrometheus.ts        # Prometheus 응답 파싱
│       │   │   └── utils.ts                  # UI 보조 유틸
│       │   └── data/
│       │       └── mockData.ts               # 대시보드 목업 데이터
│       ├── styles/
│       │   └── globals.css                   # 추가 전역 스타일
│       └── tree.txt                          # 웹 앱 구조를 추출한 참고 트리
├── docs/                                     # 운영, 배포, 아키텍처 문서
│   ├── README.md                             # 문서 진입점
│   ├── README.local-backup.md                # 로컬 백업용 README
│   ├── dashboard-local-to-aws-guide.md       # 대시보드 로컬→AWS 이전 가이드
│   ├── controlplane-api-aws-deploy-checklist.md # controlplane API 배포 체크리스트
│   ├── github-actions-flow.md                # GitHub Actions 전체 흐름 설명
│   ├── git-actions-page-technical-guide.md   # Git Actions 페이지 기술 문서
│   ├── pipeline-visualization-guide.md       # 파이프라인 시각화 가이드
│   ├── policy-page-technical-guide.md        # 정책 페이지 기술 문서
│   ├── policy-registry-dynamodb-migration.md # 정책 저장소 DynamoDB 이전 문서
│   ├── terraform-architecture-visualization.md # Terraform 아키텍처 시각화 설명
│       ├── README.md                         # 다이어그램 생성 가이드
│       ├── generate_terraform_architecture_diagrams.py # 아키텍처 다이어그램 생성 스크립트
│       ├── generated/                        # 생성된 다이어그램 출력 위치
│       └── icons/                            # 다이어그램용 SVG 아이콘
├── scripts/                                  # 로컬에서 수동 실행하는 보조 스크립트
│   ├── README.md                             # 스크립트 사용법
│   ├── setup.sh                              # bootstrap/ECR 등 초기 셋업
│   ├── deploy.sh                             # 로컬 Terraform 배포 보조
│   ├── destroy.sh                            # dev 인프라 정리
│   └── ecr-push-test.sh                      # ECR 푸시 테스트
├── security/                                 # 보안 스캔 규칙과 결과 저장소
│   ├── checkov/
│   │   └── custom_policies/                  # Checkov 커스텀 정책 위치
│   ├── semgrep/                              # Semgrep 규칙 보관 위치
│   ├── gitleaks/                             # Gitleaks 설정/출력 위치
│   ├── trivy/                                # Trivy 설정/출력 위치
│   └── reports/                              # 스캔 결과 아카이브
│       ├── checkov/                          # Checkov 결과
│       ├── semgrep/                          # Semgrep 결과
│       ├── gitleaks/                         # Gitleaks 결과
│       └── trivy/                            # Trivy 결과
├── services/                                 # 샘플 이커머스 애플리케이션 서비스들
│   ├── ecommerce-app-node/
│   │   └── api-server/                       # Node.js + Express 백엔드
│   │       ├── .env.example                  # Node API 환경변수 예시
│   │       ├── package.json                  # Node API 의존성과 스크립트
│   │       ├── Dockerfile                    # 컨테이너 이미지 빌드 정의
│   │       ├── seed.js                       # 샘플 데이터 시드
│   │       ├── data/                         # 로컬 SQLite 데이터
│   │       └── src/
│   │           ├── app.js                    # 서버 진입점
│   │           ├── config/                   # DB/AWS 설정
│   │           ├── middleware/               # 인증·Presigned URL 미들웨어
│   │           ├── routes/                   # auth/cart/order/product/review/upload 라우트
│   │           └── services/                 # 캐시·스토리지·리뷰 저장 추상화
│   ├── ecommerce-app-fastapi/
│   │   └── api-server-fastapi/               # Python FastAPI 백엔드
│   │       ├── .env.example                  # FastAPI 환경변수 예시
│   │       ├── requirements.txt              # Python 의존성
│   │       ├── Dockerfile                    # 컨테이너 이미지 빌드 정의
│   │       ├── main.py                       # FastAPI 실행 엔트리
│   │       ├── seed.py                       # 샘플 데이터 시드
│   │       ├── data/                         # 로컬 SQLite 데이터
│   │       ├── uploads/                      # 로컬 업로드 파일 위치
│   │       └── app/
│   │           ├── config/                   # 설정, DB, AWS 연결
│   │           ├── middleware/               # 인증 미들웨어
│   │           ├── models/                   # Pydantic 스키마
│   │           ├── routes/                   # auth/cart/order/product/review/upload 라우트
│   │           └── services/                 # 캐시·큐·스토리지·리뷰 저장 서비스
│   ├── ecommerce-app-spring/
│   │   └── api-server-spring/                # Spring Boot 백엔드
│   │       ├── pom.xml                       # Maven 빌드 설정
│   │       ├── mvnw                          # Maven Wrapper 실행 파일
│   │       ├── Dockerfile                    # 컨테이너 이미지 빌드 정의
│   │       ├── uploads/                      # 업로드 디렉터리 자리표시자
│   │       └── src/
│   │           └── main/
│   │               ├── java/com/shopeasy/api/
│   │               │   ├── ApiApplication.java # Spring Boot 진입점
│   │               │   ├── controller/       # REST API 컨트롤러
│   │               │   ├── service/          # DB/캐시/스토리지/큐 서비스
│   │               │   ├── config/           # AWS/CORS/Web 설정
│   │               │   ├── security/         # JWT와 인증 인터셉터
│   │               │   └── dto/              # 요청/응답 DTO
│   │               └── resources/
│   │                   ├── application.yml   # 공통 설정
│   │                   ├── application-local.yml # 로컬 실행 설정
│   │                   └── application-prod.yml.example # 운영 설정 예시
│   └── frontend/
│       └── ecommerce-app-frontend/
│           └── frontend/                     # React + Vite 프론트엔드
│               ├── package.json              # 프론트엔드 의존성과 스크립트
│               ├── package-lock.json         # npm lockfile
│               ├── Dockerfile                # Nginx 기반 프론트 이미지 빌드
│               ├── nginx.conf                # 정적 파일 서빙 설정
│               ├── vite.config.js            # 개발 서버/프록시 설정
│               ├── index.html                # 브라우저 엔트리 HTML
│               └── src/
│                   ├── main.jsx              # React 앱 마운트 엔트리
│                   ├── App.jsx               # 라우팅과 페이지 조합
│                   ├── App.css               # 앱 스타일
│                   ├── api.js                # API 호출 유틸
│                   ├── components/           # Navbar/ProductCard/Review UI
│                   ├── context/              # 인증/장바구니 상태 컨텍스트
│                   └── pages/                # 홈/로그인/회원가입/상품/주문/장바구니 화면
├── terraform/                                # AWS 인프라를 관리하는 Terraform 코드
│   ├── README.md                             # Terraform 구조 설명
│   ├── bootstrap/                            # remote state용 S3 버킷 부트스트랩
│   │   ├── main.tf                           # bootstrap 리소스 정의
│   │   ├── variables.tf                      # bootstrap 입력 변수
│   │   └── outputs.tf                        # bootstrap 출력값
│   ├── envs/                                 # 환경별 조합 루트 모듈
│   │   ├── dev/                              # 개발 환경 배포 설정
│   │   │   ├── backend.tf                    # remote state backend 선언
│   │   │   ├── backend.hcl                   # 실제 backend 값 주입 파일
│   │   │   ├── providers.tf                  # provider 설정
│   │   │   ├── variables.tf                  # 환경 입력 변수 선언
│   │   │   ├── terraform.tfvars              # dev 실제 값
│   │   │   ├── terraform.tfvars.example      # dev 예시 값
│   │   │   ├── main.tf                       # 모듈 조합 진입점
│   │   │   └── outputs.tf                    # 배포 결과 출력
│   │   └── prod/                             # 운영 환경 배포 설정
│   │       ├── backend.tf                    # remote state backend 선언
│   │       ├── backend.hcl                   # 실제 backend 값 주입 파일
│   │       ├── providers.tf                  # provider 설정
│   │       ├── variables.tf                  # 환경 입력 변수 선언
│   │       ├── terraform.tfvars.example      # prod 예시 값
│   │       ├── main.tf                       # 모듈 조합 진입점
│   │       └── outputs.tf                    # 배포 결과 출력
│   └── modules/                              # 재사용 가능한 인프라 모듈
│       ├── network/                          # VPC, 서브넷, 라우팅, NACL
│       │   ├── main.tf                       # 네트워크 리소스 정의
│       │   ├── nacl.tf                       # 네트워크 ACL 상세 규칙
│       │   ├── variables.tf                  # 네트워크 입력 변수
│       │   └── outputs.tf                    # 네트워크 출력값
│       ├── security/                         # 보안 그룹과 IAM 역할
│       ├── ecr/                              # 컨테이너 이미지 저장소
│       ├── ecs/                              # ECS 클러스터·서비스·태스크 정의
│       ├── alb/                              # Application Load Balancer
│       ├── rds/                              # MySQL RDS
│       ├── storage/                          # S3/EFS 등 스토리지
│       ├── logging/                          # CloudWatch 로그 그룹
│       ├── monitoring/                       # 모니터링/알람
│       ├── dynamodb/                         # 리뷰/정책용 DynamoDB
│       ├── cloudtrail/                       # 감사 로그 추적
│       ├── guardduty/                        # 위협 탐지
│       ├── cloudfront/                       # CDN과 정적 배포 계층
│       └── bastion/                          # 점프 서버/운영 접근용 EC2
├── .env.example                              # 루트 공통 환경변수 예시
├── .gitignore                                # Git 추적 제외 규칙
└── README.md                                 # 저장소 메인 안내 문서
```
