# Control Plane

이 폴더는 대시보드 프론트엔드와 control plane 백엔드 자리입니다.

현재 상태:

- `web`: Vite 기반 대시보드 구현 있음
- `api`: 폴더만 있고 실제 백엔드는 아직 구현 전

문서 안내:

- 로컬에서 `GitHub App + polling + controlplane/api` 흐름으로 시작:
  `docs/dashboard-local-to-aws-guide.md`
- 나중에 `controlplane/api`를 AWS에 배포할 때 수정 포인트 확인:
  `docs/controlplane-api-aws-deploy-checklist.md`
- 공개 도메인과 webhook까지 포함한 최종 GitHub App 기준:
  `docs/README.md`

## 로컬 UI 확인

```bash
cd controlplane/web
npm install
npm run dev
```

접속 주소:

- `http://localhost:5173`

PowerShell에서 실행 정책 때문에 `npm`이 막히면 아래처럼 실행합니다.

```powershell
npm.cmd run dev
```
