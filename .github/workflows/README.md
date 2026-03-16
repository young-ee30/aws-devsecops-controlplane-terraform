# GitHub Actions 안내

이 폴더에는 현재 프로젝트의 CI/CD와 보안 스캔 workflow가 들어 있습니다.

현재 사용 중인 workflow는 아래 5개입니다.

- `bootstrap-terraform-state.yml`
- `terraform-dev-plan-apply.yml`
- `deploy-node-api-ecs.yml`
- `deploy-frontend-ecs.yml`
- `pull-request-security-scans.yml`

## 자동 실행 시작 조건

`main` 브랜치에 push가 들어와도 항상 전체 배포 체인이 실행되지는 않습니다.

아래 경로 중 하나가 변경될 때 자동 체인이 시작됩니다.

- `terraform/**`
- `services/ecommerce-app-node/**`
- `services/frontend/ecommerce-app-frontend/frontend/**`
- `.github/workflows/**`

## push 후 실행 순서

조건에 맞는 `main` push가 들어오면 현재는 아래 순서로 이어집니다.

1. `bootstrap-terraform-state.yml`
2. `terraform-dev-plan-apply.yml`
3. `deploy-node-api-ecs.yml`
4. `deploy-frontend-ecs.yml`

즉 현재 구조는 아래 흐름으로 이해하면 됩니다.

`state bucket 준비 -> Terraform plan/apply -> Node 이미지 build/push/ECS 배포 -> Frontend 이미지 build/push/ECS 배포`

## 각 workflow 역할

### `bootstrap-terraform-state.yml`

역할:

- Terraform remote state용 S3 bucket을 재사용하거나 새로 만듭니다.

언제 실행되나:

- `main` push
- 수동 실행 (`workflow_dispatch`)

주요 동작:

- AWS OIDC 인증
- 기존 state bucket 확인
- 없으면 `terraform/bootstrap` 실행
- 다음 Terraform workflow가 사용할 bucket 결정

필요한 값:

- GitHub Secret: `AWS_ROLE_ARN`

### `terraform-dev-plan-apply.yml`

역할:

- dev 환경 Terraform plan/apply를 수행합니다.

언제 실행되나:

- `bootstrap-terraform-state.yml` 성공 후 자동 실행
- `main` 대상 PR
- 수동 실행 (`workflow_dispatch`)

주요 동작:

- AWS OIDC 인증
- state bucket 탐색
- `TF_VAR_DB_PASSWORD` 확인
- `backend.hcl` 생성
- `terraform fmt -check`
- `terraform init`
- `terraform validate`
- Checkov IaC 스캔
- `terraform plan`
- 조건이 맞으면 `terraform apply`

필요한 값:

- GitHub Secret: `AWS_ROLE_ARN`
- GitHub Secret: `TF_VAR_DB_PASSWORD`
- GitHub Variable: `TF_STATE_BUCKET` (선택)

비고:

- Checkov는 현재 `soft_fail: true`라서 경고만으로 전체 workflow를 실패시키지는 않습니다.

### `deploy-node-api-ecs.yml`

역할:

- Node API 이미지를 빌드하고 ECR에 push한 뒤 ECS에 배포합니다.

언제 실행되나:

- `terraform-dev-plan-apply.yml` 성공 후 자동 실행
- 수동 실행 (`workflow_dispatch`)

주요 동작:

- Gitleaks
- AWS OIDC 인증
- ECR 로그인
- Docker build
- Trivy 이미지 스캔
- ECR push
- ECS task definition 갱신
- ECS service 배포
- desired count가 0이면 1로 올림

필요한 값:

- GitHub Secret: `AWS_ROLE_ARN`

### `deploy-frontend-ecs.yml`

역할:

- Frontend 이미지를 빌드하고 ECR에 push한 뒤 ECS에 배포합니다.

언제 실행되나:

- `terraform-dev-plan-apply.yml` 성공 후 자동 실행
- 수동 실행 (`workflow_dispatch`)

주요 동작:

- Gitleaks
- AWS OIDC 인증
- ECR 로그인
- Frontend Docker build
- Trivy 이미지 스캔
- ECR push
- ECS task definition 갱신
- ECS service 배포
- desired count가 0이면 1로 올림

필요한 값:

- GitHub Secret: `AWS_ROLE_ARN`

주의:

- Frontend 배포 자동화는 추가됐지만, 프론트 애플리케이션의 API 연결 방식은 별도 애플리케이션 설정 확인이 필요할 수 있습니다.

### `pull-request-security-scans.yml`

역할:

- Pull Request 단계에서 보안 스캔을 수행합니다.

언제 실행되나:

- `main` 대상 PR
- 수동 실행 (`workflow_dispatch`)

주요 동작:

- Gitleaks
- Trivy IaC
- Trivy SCA
- Checkov

## 현재 자동 배포 대상

현재 자동 배포 대상:

- `api-node`
- `frontend`

현재 자동 배포 비대상:

- `api-python`
- `api-spring`

## 확인 포인트

배포 성공 여부는 아래 순서로 확인하는 것이 가장 빠릅니다.

1. GitHub Actions에서 관련 workflow success 확인
2. ECS service 상태 확인
3. ECS task `RUNNING` 확인
4. ALB DNS 확인
5. 애플리케이션 health check 확인
