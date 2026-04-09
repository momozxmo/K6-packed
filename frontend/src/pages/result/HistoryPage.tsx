import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { TestRecord } from '../../types';

type SortField = 'id' | 'target_url' | 'vus' | 'duration' | 'avg_response_time' | 'p95_response_time' | 'error_rate' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    setLoading(true);
    try {
      const data = await api.getTests();
      setTests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = useMemo(() => {
    let filtered = [...tests];

    if (searchQuery) {
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
      if (sortField === 'id') { aVal = Number(aVal); bVal = Number(bVal); }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tests, searchQuery, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredTests.length / perPage);
  const paginatedTests = filteredTests.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete test #${id}?`)) return;
    setDeleting(id);
    try {
      await api.deleteTest(id);
      setTests(prev => prev.filter(t => t.id !== id));
      setCompareIds(prev => prev.filter(i => i !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const toggleCompare = (id: number) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (compareIds.length === 2) {
      navigate(`/results/compare?left=${compareIds[0]}&right=${compareIds[1]}`);
    }
  };

  const handleRerun = (test: TestRecord) => {
    navigate('/', { state: { rerunTestId: test.id } });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-success/10 text-success',
      failed: 'bg-danger/10 text-danger-light',
      running: 'bg-accent/10 text-accent',
      stopped: 'bg-slate-500/10 text-slate-400',
      pending: 'bg-slate-500/10 text-slate-500',
    };
    const labels: Record<string, string> = {
      completed: 'Passed',
      failed: 'Failed',
      running: 'Running',
      stopped: 'Aborted',
      pending: 'Pending',
    };
    return (
      <span className={`px-3 py-1 rounded-lg ${styles[status] || styles.pending} text-[10px] font-bold uppercase tracking-wider`}>
        {labels[status] || status}
      </span>
    );
  };

  const errorBadge = (test: TestRecord) => {
    const errorRate = test.error_rate;
    if (errorRate === undefined || errorRate === null || test.status === 'running' || test.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-bold">
          <span className="w-1 h-1 rounded-full bg-slate-500" /> —
        </span>
      );
    }
    const pct = (errorRate * 100).toFixed(2);
    const isHigh = errorRate > 0.05;
    const isMid = errorRate > 0.01 && errorRate <= 0.05;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isHigh ? 'bg-danger/10 text-danger-light' : isMid ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
      }`}>
        <span className={`w-1 h-1 rounded-full ${
          isHigh ? 'bg-danger-light' : isMid ? 'bg-warning' : 'bg-success'
        }`} /> {pct}%
      </span>
    );
  };

  const avgColor = (avgMs: number | undefined) => {
    if (avgMs === undefined || avgMs === null) return 'text-slate-500';
    if (avgMs < 200) return 'text-success';
    if (avgMs < 500) return 'text-text-surface';
    if (avgMs < 1000) return 'text-warning';
    return 'text-danger-light';
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    sortField === field ? (
      <span className="material-symbols-outlined text-[10px]">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
    ) : null
  );

  return (
    <div className="animate-fade-in pb-20">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex-1 min-w-[300px] relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-accent transition-colors">search</span>
          <input
            type="text"
            className="w-full bg-surface-lowest border-none rounded-xl py-3 pl-12 pr-4 text-text-surface placeholder:text-slate-600 focus:ring-1 focus:ring-accent/30 transition-all font-sans text-sm"
            placeholder="Search by Target URL..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-text-surface">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 bg-surface-low p-1.5 rounded-xl">
          {['all', 'completed', 'running', 'failed', 'stopped'].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-surface-high text-accent-light'
                  : 'text-slate-400 hover:bg-surface-high/50 hover:text-text-surface'
              }`}
            >
              {status === 'all' ? (
                <><span className="material-symbols-outlined text-sm">filter_list</span> All</>
              ) : (
                status.charAt(0).toUpperCase() + status.slice(1)
              )}
            </button>
          ))}
          <button onClick={loadTests} className="p-2 text-slate-400 hover:text-text-surface transition-colors">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      {/* Data Table Container */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <span className="material-symbols-outlined text-3xl text-accent animate-spin">progress_activity</span>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-4xl text-slate-600 mb-3">inbox</span>
          <p className="text-slate-500">No tests found</p>
        </div>
      ) : (
        <div className="bg-surface-low rounded-xl overflow-hidden shadow-2xl border border-outline-variant/5">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-high/50 text-slate-400 font-label text-[10px] uppercase tracking-widest border-b border-outline-variant/10">
                <th className="py-5 px-6 w-12">
                  <span className="text-[10px] text-slate-600">Compare</span>
                </th>
                {([
                  ['id', 'Test ID', ''],
                  ['target_url', 'Target URL', ''],
                  ['vus', 'VUs', 'text-right'],
                  ['duration', 'Duration', 'text-right'],
                  ['avg_response_time', 'Avg (ms)', 'text-right'],
                  ['p95_response_time', 'P95 (ms)', 'text-right'],
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
                <th className="py-5 px-4 font-medium text-center cursor-pointer hover:text-accent-light transition-colors" onClick={() => handleSort('error_rate')}>
                  <div className="flex items-center gap-1 justify-center">
                    Error %
                    <SortIcon field="error_rate" />
                  </div>
                </th>
                <th
                  className="py-5 px-4 font-medium text-center cursor-pointer hover:text-accent-light transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1 justify-center">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
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
              {paginatedTests.map((test, i) => (
                <tr
                  key={test.id}
                  className={`hover:bg-accent/5 transition-colors border-b border-outline-variant/5 group ${
                    i % 2 === 1 ? 'bg-surface-lowest/30' : ''
                  } ${compareIds.includes(test.id) ? 'bg-accent/5' : ''}`}
                >
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(test.id)}
                      onChange={() => toggleCompare(test.id)}
                      className="rounded bg-surface-lowest border-outline-variant text-accent focus:ring-accent/20 w-4 h-4 cursor-pointer"
                      disabled={test.status !== 'completed'}
                    />
                  </td>
                  <td className="py-4 px-4 font-mono text-accent">#{test.id}</td>
                  <td className="py-4 px-4 text-slate-300 font-medium max-w-[250px] truncate">{test.target_url}</td>
                  <td className="py-4 px-4 text-right font-mono text-text-surface">{test.vus?.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right font-mono text-slate-400">{test.duration}</td>
                  <td className={`py-4 px-4 text-right font-mono ${avgColor(test.avg_response_time)}`}>
                    {test.avg_response_time != null ? test.avg_response_time.toFixed(1) : '—'}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-text-surface">
                    {test.p95_response_time != null ? test.p95_response_time.toFixed(1) : '—'}
                  </td>
                  <td className="py-4 px-4 text-center">{errorBadge(test)}</td>
                  <td className="py-4 px-4 text-center">{statusBadge(test.status)}</td>
                  <td className="py-4 px-4 text-slate-500 text-xs">
                    {test.created_at ? new Date(test.created_at).toLocaleDateString('en', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    }) : '—'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {test.status === 'completed' && (
                        <button
                          onClick={() => navigate(`/test/${test.id}/results`)}
                          className="p-1.5 hover:text-accent transition-colors"
                          title="View Results"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </button>
                      )}
                      {test.status === 'running' && (
                        <button
                          onClick={() => navigate(`/test/${test.id}/running`)}
                          className="p-1.5 text-accent hover:text-accent-light transition-colors animate-pulse"
                          title="View Running Test"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </button>
                      )}
                      {(test.status === 'completed' || test.status === 'failed') && (
                        <button
                          onClick={() => handleRerun(test)}
                          className="p-1.5 hover:text-accent transition-colors"
                          title="Re-run Test"
                        >
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(test.id)}
                        disabled={deleting === test.id || test.status === 'running'}
                        className="p-1.5 hover:text-danger-light transition-colors disabled:opacity-30"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div className="p-4 bg-surface-high/30 flex justify-between items-center text-xs text-slate-500 font-label">
            <span>Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, filteredTests.length)} of {filteredTests.length} test results</span>
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

      {/* Floating Compare Action */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60]">
          <div className="bg-surface/60 backdrop-blur-2xl px-6 py-4 rounded-full border border-accent/30 shadow-glow-accent flex items-center gap-6 animate-fade-in transition-all">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {compareIds.map(cid => (
                  <div key={cid} className="w-8 h-8 rounded-full bg-surface-lowest border border-accent/50 flex items-center justify-center text-[10px] font-mono text-accent">
                    #{cid}
                  </div>
                ))}
              </div>
              <span className="text-xs font-medium text-accent tracking-wide">{compareIds.length} Tests Selected</span>
            </div>
            <div className="h-6 w-px bg-outline-variant/30" />
            {compareIds.length === 2 && (
              <button
                onClick={handleCompare}
                className="bg-gradient-to-r from-accent-light to-accent text-surface-dark font-bold text-xs px-6 py-2.5 rounded-full flex items-center gap-2 hover:shadow-glow-accent transition-all active:scale-95 uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>compare</span>
                Compare Results
              </button>
            )}
            <button
              onClick={() => setCompareIds([])}
              className="text-slate-400 hover:text-danger-light transition-colors p-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
