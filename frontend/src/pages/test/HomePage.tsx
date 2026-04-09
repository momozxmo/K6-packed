import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/api';
import { TestConfig, SavedConfig } from '../../types';

const DURATION_OPTIONS = ['30s', '1m', '5m', '10m', '30m'];
const RAMPUP_OPTIONS = ['10s', '30s', '1m', '2m'];

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{ success: boolean; message: string; output: string } | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [configName, setConfigName] = useState('');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<TestConfig>({
    targetUrl: '',
    authDomain: '',
    username: '',
    password: '',
    vus: 10,
    duration: '1m',
    rampUp: '30s',
    postLoginUrls: [],
    loginFields: { username: 'username', password: 'password' },
    aspnetMode: false,
  });

  const [postLoginUrl, setPostLoginUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getConfigs().then(setSavedConfigs).catch(console.error);
  }, []);

  useEffect(() => {
    const state = location.state as { openLoadModal?: boolean; rerunTestId?: number } | null;

    if (state?.openLoadModal) {
      setShowLoadModal(true);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    if (state?.rerunTestId) {
      api.getTest(state.rerunTestId)
        .then(test => {
          let postLoginUrls: string[] = [];
          let loginFields = { username: 'username', password: 'password' };

          try {
            postLoginUrls = test.post_login_urls ? JSON.parse(test.post_login_urls) : [];
          } catch {
            postLoginUrls = [];
          }

          try {
            loginFields = test.login_fields ? JSON.parse(test.login_fields) : { username: 'username', password: 'password' };
          } catch {
            loginFields = { username: 'username', password: 'password' };
          }

          setConfig(prev => ({
            ...prev,
            targetUrl: test.target_url || '',
            authDomain: test.auth_domain || '',
            username: test.username || '',
            password: '',
            vus: test.vus || 10,
            duration: test.duration || '1m',
            rampUp: test.ramp_up || '30s',
            postLoginUrls,
            loginFields,
            aspnetMode: Boolean(test.aspnet_mode),
          }));
          setPrefillMessage(`Loaded configuration from test #${state.rerunTestId}. Re-enter the password before starting.`);
        })
        .catch(console.error)
        .finally(() => {
          navigate(location.pathname, { replace: true, state: {} });
        });
    }
  }, [location, navigate]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!config.targetUrl) errs.targetUrl = 'Target URL is required';
    else {
      try { new URL(config.targetUrl); } catch { errs.targetUrl = 'Invalid URL format'; }
    }
    if (!config.username) errs.username = 'Username is required';
    if (!config.password) errs.password = 'Password is required';
    if (config.vus < 1 || config.vus > 500) errs.vus = 'VUs must be 1-500';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStartTest = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const test = await api.createTest(config);
      navigate(`/test/${test.id}/running`);
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDryRun = async () => {
    if (!validate()) return;
    setDryRunning(true);
    setDryRunResult(null);
    try {
      const result = await api.dryRun(config);
      setDryRunResult(result);
    } catch (err: any) {
      setDryRunResult({ success: false, message: err.message, output: '' });
    } finally {
      setDryRunning(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!configName.trim()) return;
    try {
      await api.saveConfig(configName, config);
      const configs = await api.getConfigs();
      setSavedConfigs(configs);
      setShowSaveModal(false);
      setConfigName('');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleLoadConfig = (saved: SavedConfig) => {
    setConfig(prev => ({
      ...prev,
      ...saved.config,
      password: '',
    }));
    setShowLoadModal(false);
  };

  const handleDeleteConfig = async (id: number) => {
    try {
      await api.deleteConfig(id);
      setSavedConfigs(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const addPostLoginUrl = () => {
    if (postLoginUrl.trim()) {
      setConfig(prev => ({
        ...prev,
        postLoginUrls: [...(prev.postLoginUrls || []), postLoginUrl.trim()],
      }));
      setPostLoginUrl('');
    }
  };

  const removePostLoginUrl = (index: number) => {
    setConfig(prev => ({
      ...prev,
      postLoginUrls: prev.postLoginUrls?.filter((_, i) => i !== index),
    }));
  };

  const estimatedReqPerMin = Math.round(config.vus * 24);

  return (
    <>
    <div className="animate-fade-in pb-28">
      {/* Section Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-extrabold tracking-tight text-text-surface mb-2">Configure Execution</h2>
        <p className="text-slate-500 font-medium">Initialize a new high-concurrency stress test session.</p>
      </div>

      {prefillMessage && (
        <div className="mb-6 card border border-accent/30 bg-accent/5 flex items-start justify-between gap-4">
          <p className="text-sm text-accent-light">{prefillMessage}</p>
          <button
            onClick={() => setPrefillMessage(null)}
            className="text-slate-400 hover:text-text-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Primary Config Card */}
      <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Column: Target Configuration */}
          <div className="p-8 border-r border-outline-variant/10">
            <div className="flex items-center gap-2 mb-6 text-accent">
              <span className="material-symbols-outlined">target</span>
              <h3 className="font-label uppercase tracking-widest text-sm font-bold">Target Configuration</h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="label">Target URL *</label>
                <input
                  type="url"
                  className={`input-field ${errors.targetUrl ? 'shadow-[inset_0_0_0_1px_#ff4466]' : ''}`}
                  placeholder="https://app.example.com"
                  value={config.targetUrl}
                  onChange={e => setConfig(prev => ({ ...prev, targetUrl: e.target.value }))}
                />
                {errors.targetUrl && <p className="text-danger-light text-xs mt-1">{errors.targetUrl}</p>}
              </div>

              <div>
                <label className="label">Auth Domain</label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="auth.example.com"
                  value={config.authDomain || ''}
                  onChange={e => setConfig(prev => ({ ...prev, authDomain: e.target.value }))}
                />
                <p className="mt-2 text-[10px] font-medium text-slate-500 italic">Leave blank if same domain as Target URL</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Username *</label>
                  <input
                    type="text"
                    className={`input-field ${errors.username ? 'shadow-[inset_0_0_0_1px_#ff4466]' : ''}`}
                    value={config.username}
                    onChange={e => setConfig(prev => ({ ...prev, username: e.target.value }))}
                  />
                  {errors.username && <p className="text-danger-light text-xs mt-1">{errors.username}</p>}
                </div>
                <div>
                  <label className="label">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`input-field pr-10 ${errors.password ? 'shadow-[inset_0_0_0_1px_#ff4466]' : ''}`}
                      value={config.password}
                      onChange={e => setConfig(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-accent transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                  {errors.password && <p className="text-danger-light text-xs mt-1">{errors.password}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Test Settings */}
          <div className="p-8 bg-surface-low/30">
            <div className="flex items-center gap-2 mb-6 text-accent">
              <span className="material-symbols-outlined">tune</span>
              <h3 className="font-label uppercase tracking-widest text-sm font-bold">Test Settings</h3>
            </div>
            <div className="space-y-8">
              {/* VU Slider */}
              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="label mb-0">Virtual Users (VUs)</label>
                  <div className="bg-surface-lowest px-3 py-1 rounded border border-outline-variant/20">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      className="bg-transparent border-none text-accent font-mono font-bold text-right w-12 p-0 focus:ring-0 focus:outline-none"
                      value={config.vus}
                      onChange={e => setConfig(prev => ({ ...prev, vus: Math.min(500, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={500}
                  className="w-full h-1 bg-surface-high rounded-lg appearance-none cursor-pointer"
                  value={config.vus}
                  onChange={e => setConfig(prev => ({ ...prev, vus: parseInt(e.target.value) }))}
                />
                <div className="flex justify-between mt-2 font-mono text-[10px] text-slate-600">
                  <span>1 VU</span>
                  <span>500 VUs</span>
                </div>
                {errors.vus && <p className="text-danger-light text-xs mt-1">{errors.vus}</p>}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="label">Duration</label>
                  <select
                    className="input-field appearance-none"
                    value={config.duration}
                    onChange={e => setConfig(prev => ({ ...prev, duration: e.target.value }))}
                  >
                    {DURATION_OPTIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ramp-up</label>
                  <select
                    className="input-field appearance-none"
                    value={config.rampUp}
                    onChange={e => setConfig(prev => ({ ...prev, rampUp: e.target.value }))}
                  >
                    {RAMPUP_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* ASP.NET Toggle */}
              <div className="flex items-center justify-between p-4 bg-surface-lowest rounded-lg border border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400">developer_mode</span>
                  <div>
                    <p className="text-sm font-bold text-text-surface">ASP.NET Mode</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Automatic viewstate handling</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.aspnetMode}
                    onChange={() => setConfig(prev => ({ ...prev, aspnetMode: !prev.aspnetMode }))}
                  />
                  <div className="w-11 h-6 bg-surface-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 peer-checked:after:bg-accent after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent/20" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Section */}
      <div className="mt-8">
        <details className="group glass-panel rounded-xl overflow-hidden border-dashed border-outline-variant/30">
          <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-surface-low/50 transition-colors">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-accent group-open:rotate-180 transition-transform">expand_more</span>
              <span className="font-headline font-bold text-sm tracking-wide">Advanced Parameters</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500 px-2 py-1 bg-surface-lowest rounded">POST-LOGIN URLS & FIELDS</span>
          </summary>
          <div className="p-8 border-t border-outline-variant/10 bg-surface-lowest/20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Post-Login URLs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="label mb-0">Post-Login Verification URLs</label>
                  <button
                    onClick={addPostLoginUrl}
                    className="text-accent hover:bg-accent/10 p-1 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    className="input-field flex-1 text-xs"
                    placeholder="/dashboard/metrics"
                    value={postLoginUrl}
                    onChange={e => setPostLoginUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addPostLoginUrl()}
                  />
                </div>
                <div className="space-y-2">
                  {config.postLoginUrls?.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <div className="flex-1 bg-surface-lowest border border-outline-variant/10 rounded px-3 py-2 text-xs font-mono text-slate-400">{url}</div>
                      <button
                        onClick={() => removePostLoginUrl(i)}
                        className="opacity-0 group-hover:opacity-100 text-danger-light p-1 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Fields */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="label mb-0">Custom Login Field Names</label>
                  <span className="text-[10px] text-slate-600">KEY / VALUE PAIRS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    className="bg-surface-lowest border border-outline-variant/20 rounded px-3 py-2 text-xs font-mono text-slate-200"
                    placeholder="username_field"
                    value={config.loginFields?.username || 'username'}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      loginFields: { ...prev.loginFields!, username: e.target.value },
                    }))}
                  />
                  <input
                    type="text"
                    className="bg-surface-lowest border border-outline-variant/20 rounded px-3 py-2 text-xs font-mono text-slate-200"
                    placeholder="txtUser"
                    value="txtUser"
                    readOnly
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    className="bg-surface-lowest border border-outline-variant/20 rounded px-3 py-2 text-xs font-mono text-slate-200"
                    placeholder="password_field"
                    value={config.loginFields?.password || 'password'}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      loginFields: { ...prev.loginFields!, password: e.target.value },
                    }))}
                  />
                  <input
                    type="text"
                    className="bg-surface-lowest border border-outline-variant/20 rounded px-3 py-2 text-xs font-mono text-slate-200"
                    placeholder="txtPass"
                    value="txtPass"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Dry Run Result */}
      {dryRunResult && (
        <div className={`mt-6 card border ${dryRunResult.success ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}>
          <h4 className={`font-semibold text-sm ${dryRunResult.success ? 'text-success' : 'text-danger-light'} mb-2`}>
            {dryRunResult.success ? '✅ Dry Run Passed' : '❌ Dry Run Failed'}
          </h4>
          <p className="text-slate-400 text-sm mb-3">{dryRunResult.message}</p>
          {dryRunResult.output && (
            <pre className="log-stream text-[11px] max-h-[300px]">{dryRunResult.output}</pre>
          )}
        </div>
      )}

      {errors.submit && (
        <div className="mt-6 card border border-danger/30 bg-danger/5">
          <p className="text-danger-light text-sm">{errors.submit}</p>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-8 right-0 w-[calc(100%-5rem)] h-20 bg-surface-lowest/90 backdrop-blur-xl border-t border-outline-variant/10 flex items-center justify-between px-12 z-30">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-label uppercase text-slate-500 tracking-widest">Estimated Load</span>
            <span className="font-mono text-lg font-bold text-accent">~{estimatedReqPerMin.toLocaleString()} <span className="text-xs font-normal text-slate-400">REQ/MIN</span></span>
          </div>
          <div className="h-8 w-px bg-outline-variant/20" />
          <div className="flex flex-col">
            <span className="text-[10px] font-label uppercase text-slate-500 tracking-widest">Test Config</span>
            <span className="font-mono text-sm text-slate-200">{config.vus} VUs × {config.duration}</span>
          </div>
          <div className="h-8 w-px bg-outline-variant/20" />
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-400 hover:text-accent-light hover:border-accent/30 transition-all text-xs font-bold uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">save</span> Save
            </button>
            <button
              onClick={() => setShowLoadModal(true)}
              className="px-4 py-2 rounded-lg border border-outline-variant/30 text-slate-400 hover:text-accent-light hover:border-accent/30 transition-all text-xs font-bold uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">folder_open</span> Load
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleDryRun}
            disabled={dryRunning}
            className="btn-secondary px-6 py-2.5"
          >
            {dryRunning ? 'Testing...' : 'Dry Run'}
          </button>
          <button
            onClick={handleStartTest}
            disabled={loading}
            className="btn-primary px-8 py-2.5 flex items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            {loading ? 'Starting...' : 'Start Test'}
          </button>
        </div>
      </div>
      </div>

      {/* ─── Save Config Modal ─── */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSaveModal(false)}>
          <div className="glass-panel rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-headline font-bold text-text-surface mb-4">Save Configuration</h3>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="Config name..."
              value={configName}
              onChange={e => setConfigName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveConfig()}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSaveConfig} className="btn-primary flex-1 py-2.5">Save</button>
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Load Config Modal ─── */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowLoadModal(false)}>
          <div className="glass-panel rounded-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-headline font-bold text-text-surface mb-4">Load Configuration</h3>
            {savedConfigs.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No saved configurations yet</p>
            ) : (
              <div className="space-y-2">
                {savedConfigs.map(cfg => (
                  <div key={cfg.id} className="flex items-center justify-between bg-surface-lowest rounded-lg px-4 py-3 hover:bg-surface-hover transition-colors">
                    <button onClick={() => handleLoadConfig(cfg)} className="flex-1 text-left">
                      <p className="text-sm font-medium text-text-surface">{cfg.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{(cfg.config as any)?.targetUrl || 'No URL'}</p>
                    </button>
                    <button onClick={() => handleDeleteConfig(cfg.id)} className="text-slate-500 hover:text-danger-light transition-colors ml-2">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowLoadModal(false)} className="btn-secondary w-full mt-4 py-2.5">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
