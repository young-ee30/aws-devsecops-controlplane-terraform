# 🚀 Control Plane (AI DevSecOps 관제 플랫폼)

이 폴더는 프로젝트의 핵심인 통합 관제 대시보드(React)와 AI 백엔드(FastAPI) 코드를 포함합니다.

## 🛠️ 초기 로컬 세팅 가이드 (최초 1회 실행)

프로젝트를 `git pull` 받은 후, 다음 명령어를 순서대로 터미널에 입력하여 필요한 라이브러리를 설치해야 합니다.

### 1. 프론트엔드 (Web) 세팅
```bash
# 1. 루트 디렉토리에서 웹 폴더로 이동
cd controlplane/web

# 2. 필요한 패키지 설치 (Vite, Tailwind, Recharts 등)
npm install

# 3. 로컬 개발 서버 실행
npm run dev
```