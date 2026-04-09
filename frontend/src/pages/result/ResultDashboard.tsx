import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { TestRecord } from '../../types';
import GrafanaEmbed from '../../components/GrafanaEmbed';
import { useEffect, useState } from 'react';

export default function ResultDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const testId = parseInt(id || '0');
  const [showExport, setShowExport] = useState(false);
  const [test, setTest] = useState<TestRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTest(testId)
      .then(setTest)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-accent animate-spin">progress_activity</span>
          <span className="font-label text-sm text-slate-500 uppercase tracking-widest">Loading Results</span>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="card max-w-lg mx-auto mt-20 text-center">
        <span className="material-symbols-outlined text-4xl text-danger-light mb-4">error</span>
        <p className="text-danger-light mb-4">Test not found</p>
        <Link to="/history" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back to History
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ═══ Dashboard Header ═══ */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-extrabold tracking-tight font-headline">Test Results #{testId}</h2>
            <span className="px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold tracking-widest border border-success/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              COMPLETED
            </span>
          </div>
          <p className="font-mono text-sm text-slate-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">link</span>
            {test?.target_url || `Test #${testId}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container hover:bg-surface-high transition-all text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-lg">file_download</span>
              Export
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showExport && (
              <div className="absolute right-0 mt-2 w-48 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden">
                <a href={api.exportJson(testId)} download className="flex items-center gap-3 px-4 py-3 hover:bg-surface-high/50 transition-colors text-sm">
                  <span className="material-symbols-outlined text-accent text-lg">data_object</span> Export JSON
                </a>
                <a href={api.exportCsv(testId)} download className="flex items-center gap-3 px-4 py-3 hover:bg-surface-high/50 transition-colors text-sm">
                  <span className="material-symbols-outlined text-success text-lg">table_view</span> Export CSV
                </a>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/', { state: { rerunTestId: testId } })}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-light to-accent text-surface-dark font-bold text-sm shadow-glow-accent hover:shadow-glow-accent-lg transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
            Re-run Test
          </button>
        </div>
      </section>

      {/* ═══ Grafana Dashboard (Full Width) ═══ */}
      <section className="mb-8">
        <GrafanaEmbed
          from={test?.started_at ? new Date(test.started_at).getTime().toString() : 'now-30m'}
          to={test?.completed_at ? new Date(test.completed_at).getTime().toString() : 'now'}
          height={800}
        />
      </section>
    </div>
  );
}
