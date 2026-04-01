import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import HomePage from './pages/HomePage';
import TestRunningPage from './pages/TestRunningPage';
import ResultDashboard from './pages/ResultDashboard';
import HistoryPage from './pages/HistoryPage';
import ResultsPage from './pages/ResultsPage';
import CompareResultsPage from './pages/CompareResultsPage';
import { api } from './lib/api';
import { TestRecord } from './types';

const navItems = [
  { path: '/', icon: 'add_box', label: 'New Test' },
  { path: '/running', icon: 'insights', label: 'Live' },
  { path: '/results', icon: 'analytics', label: 'Results' },
  { path: '/history', icon: 'history', label: 'History' },
];

const pageTitle: Record<string, string> = {
  '/': 'New Load Test',
  '/history': 'Test History',
  '/results': 'Results Archive',
  '/results/compare': 'Compare Results',
};

function LatestTestRedirect({ mode }: { mode: 'running' }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    api.getTests()
      .then((tests: TestRecord[]) => {
        if (cancelled) return;

        const runningTest = tests.find(t => t.status === 'running') || tests.find(t => t.status === 'pending');
        if (runningTest) {
          navigate(`/test/${runningTest.id}/running`, { replace: true });
          return;
        }
        setMessage('No running test found. Start a test to view the live monitor.');
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('Unable to load test navigation right now.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, navigate]);

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="card max-w-lg text-center">
        {loading ? (
          <>
            <span className="material-symbols-outlined text-4xl text-accent animate-spin mb-4">progress_activity</span>
            <p className="text-slate-400">Opening live monitor...</p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-4xl text-slate-500 mb-4">
              insights
            </span>
            <p className="text-slate-400 mb-4">{message}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-lg bg-accent text-surface-dark font-bold text-sm"
              >
                New Test
              </button>
              <button
                onClick={() => navigate('/history')}
                className="px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-300 text-sm"
              >
                History
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [stoppingTest, setStoppingTest] = useState(false);

  const runningTestId = useMemo(() => {
    const match = location.pathname.match(/^\/test\/(\d+)\/running$/);
    return match ? parseInt(match[1], 10) : null;
  }, [location.pathname]);

  const getPageTitle = () => {
    if (location.pathname.includes('/running')) return 'Live Monitor';
    if (location.pathname.match(/^\/test\/\d+\/results$/)) return 'Test Results';
    if (location.pathname === '/results/compare') return 'Compare Results';
    return pageTitle[location.pathname] || 'Dashboard';
  };

  const isNavActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/running') return location.pathname.includes('/running');
    if (path === '/results') return location.pathname.includes('/results');
    return location.pathname === path;
  };

  const handleLoadSavedConfig = () => {
    navigate('/', { state: { openLoadModal: true } });
  };

  const handleStopRunningTest = async () => {
    if (!runningTestId || stoppingTest) return;
    setStoppingTest(true);
    try {
      await api.stopTest(runningTestId);
    } catch (error) {
      console.error(error);
    } finally {
      setStoppingTest(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* ─── Noise Texture ─── */}
      <div className="noise-bg" />

      {/* ─── Sidebar Navigation ─── */}
      <nav className="fixed left-0 top-0 h-full z-50 py-6 flex flex-col items-center justify-between w-20 bg-surface-lowest border-r border-surface-high/30 shadow-sidebar">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Logo */}
          <Link to="/" className="w-12 h-12 rounded-xl bg-surface-high flex items-center justify-center border border-outline-variant/20 shadow-lg hover:shadow-glow-accent transition-all duration-300">
            <span className="text-accent font-bold tracking-tighter text-xl font-headline">K6</span>
          </Link>

          {/* Nav Items */}
          <div className="flex flex-col gap-2 w-full px-2">
            {navItems.map(item => {
              const active = isNavActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`w-full py-3 flex flex-col items-center justify-center gap-1 rounded-lg transition-all duration-150 ease-out-expo ${
                    active
                      ? 'text-accent-light bg-accent/10 border-l-4 border-accent relative after:content-[""] after:absolute after:right-0 after:w-1 after:h-full after:bg-accent after:shadow-[0_0_8px_#00d4ff]'
                      : 'text-slate-500 hover:text-accent-light hover:bg-surface-dim border-l-4 border-transparent'
                  } active:scale-90`}
                  title={item.label}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  <span className="font-sans text-[10px] font-medium tracking-wide uppercase">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-[10px] font-mono font-medium tracking-wide uppercase text-slate-500 transform -rotate-90 origin-center whitespace-nowrap mb-4">
            V1.0.4
          </div>
          <div className="w-10 h-10 rounded-full bg-surface-high border border-outline-variant/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
          </div>
        </div>
      </nav>

      {/* ─── Top App Bar ─── */}
      <header className="fixed top-0 ml-20 w-[calc(100%-5rem)] h-16 flex justify-between items-center px-8 bg-surface-dark/80 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-accent-light font-black tracking-widest text-lg">K6 MISSION CONTROL</h1>
          <div className="h-4 w-px bg-outline-variant/30" />
          <span className="font-headline font-bold text-sm text-accent tracking-tight">{getPageTitle()}</span>
        </div>
        <div className="flex items-center gap-6">
          {runningTestId && (
            <button
              onClick={handleStopRunningTest}
              disabled={stoppingTest}
              className="flex items-center gap-2 bg-danger/10 border border-danger/20 px-3 py-1.5 rounded-lg hover:bg-danger/20 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-danger-light text-sm group-hover:animate-pulse">stop_circle</span>
              <span className="font-label text-xs font-bold text-danger-light tracking-wider uppercase">
                {stoppingTest ? 'Stopping...' : 'Stop Test'}
              </span>
            </button>
          )}

          <button
            onClick={handleLoadSavedConfig}
            className="flex items-center gap-2 text-slate-400 hover:text-accent-light transition-opacity duration-200 cursor-pointer font-sans font-bold text-sm"
          >
            Load Saved Config
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400 hover:text-accent-light cursor-pointer transition-colors duration-200">settings</span>
            <span className="material-symbols-outlined text-slate-400 hover:text-accent-light cursor-pointer transition-colors duration-200">help_outline</span>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="ml-20 pt-20 px-8 pb-10 min-h-screen">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/running" element={<LatestTestRedirect mode="running" />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/compare" element={<CompareResultsPage />} />
          <Route path="/test/:id/running" element={<TestRunningPage />} />
          <Route path="/test/:id/results" element={<ResultDashboard />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>

      {/* ─── Footer Status Bar ─── */}
      <footer className="fixed bottom-0 ml-20 w-[calc(100%-5rem)] h-8 bg-surface-lowest border-t border-outline-variant/10 flex items-center justify-between px-8 z-40">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-success animate-pulse" />
            <span className="font-label text-[9px] text-slate-500 uppercase tracking-widest">System: <span className="text-slate-300">Online</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-label text-[9px] text-slate-500 uppercase tracking-widest">K6 Load Test Dashboard — Internal Tool</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
