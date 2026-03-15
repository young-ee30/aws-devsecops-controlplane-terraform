import { ShieldAlert, Activity, Bot, LayoutDashboard } from 'lucide-react';

function App() {
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* 1. 왼쪽 사이드바 영역 */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <ShieldAlert className="w-8 h-8 text-blue-500" />
          <h1 className="text-xl font-bold text-white">DevSecOps</h1>
        </div>
        
        <nav className="flex flex-col gap-2">
          <button className="flex items-center gap-3 bg-blue-600/20 text-blue-400 px-4 py-3 rounded-lg font-medium transition-colors border border-blue-500/30">
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
        </nav>
      </div>

      {/* 2. 메인 대시보드 3분할 영역 */}
      <div className="flex-1 flex flex-col h-full p-6">
        <header className="mb-6">
          <h2 className="text-2xl font-bold text-white">통합 관제 센터</h2>
          <p className="text-slate-400 text-sm mt-1">실시간 트래픽 및 보안 위협 모니터링</p>
        </header>

        {/* 그리드로 3등분 (1 : 2 : 1 비율) */}
        <div className="flex-1 grid grid-cols-4 gap-6 min-h-0">
          
          {/* 좌측: 정적 보안 상태판 (비율 1) */}
          <div className="col-span-1 bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-white">보안 위협 경고</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
              <p>카드 컴포넌트 들어갈 자리</p>
            </div>
          </div>

          {/* 중앙: 실시간 관제 차트 (비율 2) */}
          <div className="col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">실시간 트래픽 모니터링</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
              <p>Recharts 꺾은선 그래프 들어갈 자리</p>
            </div>
          </div>

          {/* 우측: AI 해결사 패널 (비율 1) */}
          <div className="col-span-1 bg-slate-900 rounded-xl border border-blue-900/50 p-4 flex flex-col shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <Bot className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">AI 에이전트</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-slate-700 rounded-lg">
              <Bot className="w-12 h-12 text-slate-600 opacity-50" />
              <p className="text-sm text-center">분석할 위협을 클릭하면<br/>AI가 해결책을 제시합니다.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;