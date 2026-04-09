import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { TestRecord } from '../../types';

type ResultStatus = 'completed' | 'failed' | 'stopped';
type SortField = 'id' | 'target_url' | 'avg_response_time' | 'p95_response_time' | 'throughput' | 'error_rate' | 'created_at';
type SortDir = 'asc' | 'desc';

const RESULT_STATUSES: ResultStatus[] = ['completed', 'failed', 'stopped'];

export default function ResultsPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ResultStatus>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = 10;

  useEffect(() => {
    void loadResults();
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await api.getTests();
      setTests(data.filter(t => RESULT_STATUSES.includes(t.status as ResultStatus)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    let filtered = [...tests];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.target_url.toLowerCase().includes(q) ||
        t.username.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof TestRecord];
      let bVal: any = b[sortField as keyof TestRecord];

      if (sortField === 'id') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tests, searchQuery, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / perPage));
  const paginatedResults = filteredResults.slice((currentPage - 1) * perPage, currentPage * perPage);

  const stats = useMemo(() => {
    const completed = tests.filter(t => t.status === 'completed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const stopped = tests.filter(t => t.status === 'stopped').length;
    const avgLatencyValues = tests
      .map(t => t.avg_response_time)
      .filter((v): v is number => typeof v === 'number');

    const avgLatency = avgLatencyValues.length
      ? avgLatencyValues.reduce((sum, v) => sum + v, 0) / avgLatencyValues.length
      : 0;

    return {
      total: tests.length,
      completed,
      failed,
      stopped,
      avgLatency,
    };
  }, [tests]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-success/10 text-success',
      failed: 'bg-danger/10 text-danger-light',
      stopped: 'bg-slate-500/10 text-slate-400',
    };

    const labels: Record<string, string> = {
      completed: 'Passed',
      failed: 'Failed',
      stopped: 'Aborted',
    };

    return (
      <span className={`px-3 py-1 rounded-lg ${styles[status] || 'bg-slate-500/10 text-slate-400'} text-[10px] font-bold uppercase tracking-wider`}>
        {labels[status] || status}
      </span>
    );
  };

  const errorBadge = (errorRate?: number) => {
    if (errorRate == null) {
      return <span className="text-slate-500">â€”</span>;
    }

    const pct = (errorRate * 100).toFixed(2);
    const tone =
      errorRate > 0.05
        ? 'bg-danger/10 text-danger-light'
        : errorRate > 0.01
          ? 'bg-warning/10 text-warning'
          : 'bg-success/10 text-success';

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${tone}`}>
        <span className="w-1 h-1 rounded-full bg-current" />
        {pct}%
      </span>
    );
  };

  const metricColor = (value?: number) => {
    if (value == null) return 'text-slate-500';
    if (value < 200) return 'text-success';
    if (value < 500) return 'text-text-surface';
    if (value < 1000) return 'text-warning';
    return 'text-danger-light';
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <span className="material-symbols-outlined text-[10px]">
        {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    ) : null;

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-text-surface mb-2">
          Results Archive
        </h2>
        <p className="text-slate-500 font-medium">
          Browse older saved test results and reopen any dashboard at any time.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 stagger-children">
        <StatCard label="Saved Results" value={String(stats.total)} icon="analytics" accent />
        <StatCard label="Passed" value={String(stats.completed)} icon="task_alt" color="success" />
        <StatCard label="Failed" value={String(stats.failed)} icon="error" color="danger" />
        <StatCard label="Avg Latency" value={stats.avgLatency ? stats.avgLatency.toFixed(1) : '0.0'} unit="ms" icon="timer" />
      </section>

      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex-1 min-w-[300px] relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-accent transition-colors">
            search
          </span>
          <input
            type="text"
            className="w-full bg-surface-lowest border-none rounded-xl py-3 pl-12 pr-4 text-text-surface placeholder:text-slate-600 focus:ring-1 focus:ring-accent/30 transition-all font-sans text-sm"
            placeholder="Search saved results..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-text-surface"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 bg-surface-low p-1.5 rounded-xl">
          {(['all', 'completed', 'failed', 'stopped'] as const).map(status => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-surface-high text-accent-light'
                  : 'text-slate-400 hover:bg-surface-high/50 hover:text-text-surface'
              }`}
            >
              {status === 'all' ? (
                <>
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  All
                </>
              ) : (
                status.charAt(0).toUpperCase() + status.slice(1)
              )}
            </button>
          ))}

          <button onClick={loadResults} className="p-2 text-slate-400 hover:text-text-surface transition-colors">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="material-symbols-outlined text-3xl text-accent animate-spin">progress_activity</span>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-4xl text-slate-600 mb-3">analytics</span>
          <p className="text-slate-400 mb-2">No saved results found</p>
          <p className="text-slate-500 text-sm">Run a test first, then its result will stay available here.</p>
        </div>
      ) : (
        <div className="bg-surface-low rounded-xl overflow-hidden shadow-2xl border border-outline-variant/5">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-high/50 text-slate-400 font-label text-[10px] uppercase tracking-widest border-b border-outline-variant/10">
                {([
                  ['id', 'Test ID', ''],
                  ['target_url', 'Target URL', ''],
                  ['avg_response_time', 'Avg (ms)', 'text-right'],
                  ['p95_response_time', 'P95 (ms)', 'text-right'],
                  ['throughput', 'Throughput', 'text-right'],
                ] as [SortField, string, string][]).map(([field, label, align]) => (
                  <th
                    key={field}
                    className={`py-5 px-4 font-medium cursor-pointer hover:text-accent-light transition-colors ${align}`}
                    onClick={() => handleSort(field)}
                  >
                    <div className={`flex items-center gap-1 ${align === 'text-right' ? 'justify-end' : ''}`}>
                      {label}
                      <SortIcon field={field} />
                    </div>
                  </th>
                ))}

                <th
                  className="py-5 px-4 font-medium text-center cursor-pointer hover:text-accent-light transition-colors"
                  onClick={() => handleSort('error_rate')}
                >
                  <div className="flex items-center gap-1 justify-center">
                    Error %
                    <SortIcon field="error_rate" />
                  </div>
                </th>

                <th className="py-5 px-4 font-medium text-center">Status</th>

                <th
                  className="py-5 px-4 font-medium cursor-pointer hover:text-accent-light transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    <SortIcon field="created_at" />
                  </div>
                </th>

                <th className="py-5 px-6 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="font-sans text-sm">
              {paginatedResults.map((test, i) => (
                <tr
                  key={test.id}
                  className={`hover:bg-accent/5 transition-colors border-b border-outline-variant/5 group ${
                    i % 2 === 1 ? 'bg-surface-lowest/30' : ''
                  }`}
                >
                  <td className="py-4 px-4 font-mono text-accent">#{test.id}</td>
                  <td className="py-4 px-4 text-slate-300 font-medium max-w-[320px] truncate">{test.target_url}</td>
                  <td className={`py-4 px-4 text-right font-mono ${metricColor(test.avg_response_time)}`}>
                    {test.avg_response_time != null ? test.avg_response_time.toFixed(1) : 'â€”'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-text-surface">
                    {test.p95_response_time != null ? test.p95_response_time.toFixed(1) : 'â€”'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-text-surface">
                    {test.throughput != null ? test.throughput.toFixed(1) : 'â€”'}
                  </td>
                  <td className="py-4 px-4 text-center">{errorBadge(test.error_rate)}</td>
                  <td className="py-4 px-4 text-center">{statusBadge(test.status)}</td>
                  <td className="py-4 px-4 text-slate-500 text-xs">
                    {test.created_at
                      ? new Date(test.created_at).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'â€”'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/test/${test.id}/results`)}
                        className="p-1.5 hover:text-accent transition-colors"
                        title="Open Results"
                      >
                        <span className="material-symbols-outlined text-lg">visibility</span>
                      </button>
                      <button
                        onClick={() => navigate('/', { state: { rerunTestId: test.id } })}
                        className="p-1.5 hover:text-accent transition-colors"
                        title="Re-run Test"
                      >
                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-4 bg-surface-high/30 flex justify-between items-center text-xs text-slate-500 font-label">
            <span>
              Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, filteredResults.length)} of{' '}
              {filteredResults.length} saved results
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 hover:text-text-surface disabled:opacity-30"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg transition-colors ${
                      currentPage === page ? 'bg-accent/20 text-accent font-bold' : 'hover:bg-surface-variant'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              {totalPages > 5 && <span>...</span>}

              {totalPages > 5 && (
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-lg transition-colors ${
                    currentPage === totalPages ? 'bg-accent/20 text-accent font-bold' : 'hover:bg-surface-variant'
                  }`}
                >
                  {totalPages}
                </button>
              )}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 hover:text-text-surface disabled:opacity-30"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon,
  accent,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  accent?: boolean;
  color?: 'success' | 'danger';
}) {
  const valueClass = accent
    ? 'text-accent'
    : color === 'success'
      ? 'text-success'
      : color === 'danger'
        ? 'text-danger-light'
        : 'text-text-surface';

  const iconBg = accent
    ? 'bg-accent/10 text-accent'
    : color === 'success'
      ? 'bg-success/10 text-success'
      : color === 'danger'
        ? 'bg-danger/10 text-danger-light'
        : 'bg-surface-high text-slate-300';

  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/10 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </div>
        <span className="font-label text-xs uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <div className={`font-mono text-3xl font-bold leading-none ${valueClass}`}>
        {value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}
