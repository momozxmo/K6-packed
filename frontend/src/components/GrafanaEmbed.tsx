import { useState } from 'react';

const GRAFANA_BASE_URL = (import.meta as any).env?.VITE_GRAFANA_URL || 'http://localhost:3000';
const DASHBOARD_UID = 'k6-dashboard';

interface GrafanaEmbedProps {
  /** Optional time range override, e.g. "now-30m" */
  from?: string;
  to?: string;
  /** Height of the embedded panel */
  height?: number;
  /** Optional panel ID to embed a single panel instead of the full dashboard */
  panelId?: number;
  /** CSS class name */
  className?: string;
}

export default function GrafanaEmbed({
  from = 'now-15m',
  to = 'now',
  height = 800,
  panelId,
  className = '',
}: GrafanaEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Build Grafana embed URL
  // &kiosk hides the Grafana chrome (navbar, sidebar)
  // &refresh=5s auto-refreshes the dashboard
  let embedUrl = `${GRAFANA_BASE_URL}/d/${DASHBOARD_UID}/k6-load-testing-results?orgId=1&kiosk&refresh=5s&from=${from}&to=${to}&theme=dark&autofitpanels`;

  // If panelId is specified, embed just that single panel
  if (panelId !== undefined) {
    embedUrl = `${GRAFANA_BASE_URL}/d-solo/${DASHBOARD_UID}/k6-load-testing-results?orgId=1&panelId=${panelId}&refresh=5s&from=${from}&to=${to}&theme=dark`;
  }

  return (
    <div className={`grafana-embed-wrapper ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff6600]/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 12C22 6.477 17.523 2 12 2S2 6.477 2 12s4.477 10 10 10 10-4.477 10-10z" fill="#FF6600" fillOpacity="0.2"/>
              <circle cx="12" cy="12" r="3" fill="#FF6600"/>
              <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m17.07-7.07l-2.83 2.83M7.76 16.24l-2.83 2.83m14.14 0l-2.83-2.83M7.76 7.76L4.93 4.93" stroke="#FF6600" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h3 className="font-headline font-bold text-sm tracking-wide">Grafana Analytics</h3>
            <p className="text-[10px] text-slate-500 font-label uppercase tracking-widest">
              Powered by InfluxDB • Real-time metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${GRAFANA_BASE_URL}/d/${DASHBOARD_UID}/k6-load-testing-results?orgId=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant/20 bg-surface-container hover:bg-surface-high transition-all text-xs font-semibold text-slate-400 hover:text-text-surface"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Open in Grafana
          </a>
        </div>
      </div>

      {/* Iframe Container */}
      <div
        className="relative rounded-xl border border-outline-variant/10 bg-[#0b0c10]"
      >
        {/* Loading Overlay */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-lowest z-10" style={{ minHeight: '400px' }}>
            <div className="flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-accent animate-spin">progress_activity</span>
              <span className="font-label text-xs text-slate-500 uppercase tracking-widest">
                Connecting to Grafana...
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="flex items-center justify-center bg-surface-lowest z-10" style={{ minHeight: '400px' }}>
            <div className="flex flex-col items-center gap-4 text-center px-8">
              <span className="material-symbols-outlined text-4xl text-slate-600">cloud_off</span>
              <div>
                <p className="text-sm text-slate-400 mb-1">Cannot connect to Grafana</p>
                <p className="text-xs text-slate-600">
                  Make sure Docker services are running: <code className="text-accent/80">docker-compose up -d</code>
                </p>
              </div>
              <a
                href={GRAFANA_BASE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:text-accent-light transition-colors"
              >
                Try opening Grafana directly →
              </a>
            </div>
          </div>
        )}

        <iframe
          src={embedUrl}
          width="100%"
          height={height}
          frameBorder="0"
          scrolling="no"
          onLoad={() => setIsLoading(false)}
          onError={() => { setIsLoading(false); setHasError(true); }}
          style={{
            border: 'none',
            backgroundColor: '#0b0c10',
            display: 'block',
          }}
          title="Grafana K6 Dashboard"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}
