import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../lib/api';
import { TestRecord } from '../types';

export default function TestRunningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const testId = parseInt(id || '0');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [test, setTest] = useState<TestRecord | null>(null);
  const [stopping, setStopping] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState('00:00:00');

  const handleComplete = useCallback((code: number | null) => {
    setCompleted(true);
    setExitCode(code);
  }, []);

  const { isConnected, logs, progress, clearLogs } = useWebSocket({
    testId,
    onComplete: handleComplete,
  });

  useEffect(() => {
    api.getTest(testId).then(setTest).catch(console.error);
  }, [testId]);

  useEffect(() => {
    if (completed) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const hrs = Math.floor(diff / 3600).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${hrs}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, completed]);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    if (isNearBottom || logs.length <= 1) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [logs]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await api.stopTest(testId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewResults = () => {
    navigate(`/test/${testId}/results`);
  };

  const getDurationSeconds = (): number => {
    const d = test?.duration || '1m';
    const ramp = test?.ramp_up || '30s';
    const parseDur = (s: string): number => {
      const match = s.match(/(\d+)(s|m)/);
      if (!match) return 60;
      return match[2] === 'm' ? parseInt(match[1]) * 60 : parseInt(match[1]);
    };
    return parseDur(d) + parseDur(ramp) + 10;
  };

  const progressPercent = completed ? 100 : Math.min(99, (Date.now() - startTime) / (getDurationSeconds() * 1000) * 100);
  const timeRemaining = (() => {
    const totalSec = getDurationSeconds();
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, totalSec - elapsedSec);
    const hrs = Math.floor(remaining / 3600).toString().padStart(2, '0');
    const mins = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0');
    const secs = (remaining % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  })();

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
  };

  // Generate sparkline bar heights based on requests
  const sparkBars = [20, 30, 50, 40, 80, 70, 40, 90, 50, 90];

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* ═══ Progress Section ═══ */}
      <section className="bg-surface-lowest rounded-xl p-6 border border-outline-variant/10 shadow-lg">
        <div className="flex justify-between items-end mb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {completed ? (
                exitCode === 0 ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="font-label text-[10px] font-bold tracking-[0.2em] text-success uppercase">Test Completed</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-danger" />
                    <span className="font-label text-[10px] font-bold tracking-[0.2em] text-danger-light uppercase">Test Failed</span>
                  </>
                )
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                  <span className="font-label text-[10px] font-bold tracking-[0.2em] text-success uppercase">Test Running</span>
                </>
              )}
            </div>
            <h2 className="font-headline text-2xl font-extrabold text-text-surface">Live Execution Progress</h2>
          </div>
          <div className="flex items-end gap-6 text-right">
            {!completed && (
              <div className="flex flex-col">
                <span className="font-label text-[10px] text-slate-500 uppercase tracking-widest">Time Remaining</span>
                <span className="font-mono text-2xl text-accent-light">{timeRemaining}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-label text-[10px] text-slate-500 uppercase tracking-widest">Completion</span>
              <span className="font-mono text-2xl text-text-surface">{progressPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="w-full h-3 bg-surface-high rounded-full overflow-hidden p-[2px]">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              completed
                ? exitCode === 0
                  ? 'bg-gradient-to-r from-success/80 to-success shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                  : 'bg-gradient-to-r from-danger/80 to-danger shadow-[0_0_12px_rgba(255,68,102,0.4)]'
                : 'bg-gradient-to-r from-accent to-accent-light shadow-[0_0_12px_rgba(0,212,255,0.4)]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* ═══ Metric Grid ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
        {/* Active VUs */}
        <div className="bg-surface rounded-xl p-5 border border-outline-variant/10 flex flex-col gap-4 relative overflow-hidden group hover:border-accent/20 transition-all duration-300">
          <div className="absolute top-0 right-0 p-2 opacity-[0.04]">
            <span className="material-symbols-outlined text-6xl text-text-surface" style={{ fontVariationSettings: "'opsz' 48" }}>group</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-accent text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            </div>
            <span className="font-label text-xs text-slate-400 uppercase tracking-wider">Active VUs</span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-4xl font-bold text-text-surface">{progress?.currentVUs ?? test?.vus ?? '—'}</span>
            <span className="text-[10px] text-success flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[10px]">trending_up</span> Target: {test?.vus || '—'}
            </span>
          </div>
        </div>

        {/* Reqs/Sec */}
        <div className="bg-surface rounded-xl p-5 border border-outline-variant/10 flex flex-col gap-4 relative overflow-hidden group hover:border-accent/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-accent text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <span className="font-label text-xs text-slate-400 uppercase tracking-wider">Reqs / Sec</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-4xl font-bold text-text-surface">{progress?.requestsPerSec?.toFixed(1) ?? '—'}</span>
            <div className="h-10 w-full flex items-end gap-1 opacity-60">
              {sparkBars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-accent rounded-sm transition-all duration-500"
                  style={{ height: `${h}%`, opacity: 0.2 + (h / 100) * 0.8 }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Avg Resp Time */}
        <div className="bg-surface rounded-xl p-5 border border-outline-variant/10 flex flex-col gap-4 relative overflow-hidden group hover:border-success/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-success text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            </div>
            <span className="font-label text-xs text-slate-400 uppercase tracking-wider">Avg Resp Time</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold text-success">{progress?.avgResponseTime?.toFixed(0) ?? '—'}</span>
              <span className="font-mono text-sm text-slate-500">ms</span>
            </div>
            <div className="flex gap-1 mt-3">
              <div className={`h-1 flex-1 rounded-full ${(progress?.avgResponseTime ?? 0) < 500 ? 'bg-success' : 'bg-warning'}`} />
              <div className="h-1 flex-1 bg-surface-high rounded-full" />
              <div className="h-1 flex-1 bg-surface-high rounded-full" />
            </div>
            <span className="text-[10px] text-success mt-2 font-medium tracking-tight">
              {(progress?.avgResponseTime ?? 0) < 500 ? 'Optimal Performance' : 'Moderate Load'}
            </span>
          </div>
        </div>

        {/* Errors */}
        <div className="bg-surface rounded-xl p-5 border border-outline-variant/10 flex flex-col gap-4 relative overflow-hidden group hover:border-danger/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-danger-light text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>report</span>
            </div>
            <span className="font-label text-xs text-slate-400 uppercase tracking-wider">Errors</span>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-4xl font-bold text-danger-light">{progress?.errorCount ?? 0}</span>
            <span className="text-[10px] text-danger-light/80 flex items-center gap-1 mt-1 font-medium">
              {progress?.errorCount ? `${((progress.errorCount / (progress.completedIterations || 1)) * 100).toFixed(2)}% Failure Rate` : '0.00% Failure Rate'}
            </span>
          </div>
        </div>
      </section>

      {/* ═══ Live Telemetry Log Panel ═══ */}
      <section className="flex-1 flex flex-col bg-surface-lowest rounded-xl border border-outline-variant/10 overflow-hidden min-h-[400px]">
        <div className="bg-surface-low px-6 py-3 flex justify-between items-center border-b border-outline-variant/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-500 text-sm">terminal</span>
            <h3 className="font-label text-xs font-bold text-slate-300 uppercase tracking-[0.15em]">Live System Telemetry</h3>
            {isConnected ? (
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" title="Connected" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-danger" title="Disconnected" />
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={clearLogs} className="px-3 py-1 rounded bg-surface-high text-[10px] font-bold text-slate-400 hover:text-text-surface transition-colors uppercase tracking-widest">Clear</button>
            <button onClick={copyLogs} className="px-3 py-1 rounded bg-surface-high text-[10px] font-bold text-slate-400 hover:text-text-surface transition-colors uppercase tracking-widest">Copy Log</button>
            <span className="text-xs text-slate-600 font-mono self-center ml-2">{logs.length} lines</span>
          </div>
        </div>
        <div ref={logContainerRef} className="flex-1 p-6 font-mono text-xs leading-relaxed overflow-y-auto bg-surface-dark">
          <div className="flex flex-col gap-1.5">
            {logs.length === 0 ? (
              <p className="text-slate-500 italic animate-pulse">Waiting for telemetry data...</p>
            ) : (
              logs.map((line, i) => (
                <p key={i} className={
                  line.includes('[stderr]') || line.includes('error') || line.includes('ERROR')
                    ? 'text-danger-light font-bold'
                    : line.includes('WARN')
                      ? 'text-danger-light/80'
                      : line.includes('✅') || line.includes('✓') || line.includes('200 OK')
                        ? 'text-text-surface'
                        : 'text-slate-500'
                }>
                  {line}
                </p>
              ))
            )}
            <div />
          </div>
        </div>
      </section>

      {/* ═══ Completed / Stop Action Bar ═══ */}
      {(completed || !completed) && (
        <div className="flex justify-end">
          {completed ? (
            <button
              onClick={handleViewResults}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-light to-accent text-surface-dark font-bold text-sm shadow-glow-accent hover:shadow-glow-accent-lg transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
              View Results
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="flex items-center gap-2 bg-danger/10 border border-danger/20 px-5 py-2.5 rounded-xl cursor-pointer hover:bg-danger/20 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-danger-light text-sm group-hover:animate-pulse">stop_circle</span>
              <span className="font-label text-xs font-bold text-danger-light tracking-wider uppercase">{stopping ? 'Stopping...' : 'Stop Test'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
