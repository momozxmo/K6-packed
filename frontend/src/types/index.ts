// ─── Test Configuration ─────────────────────
export interface TestConfig {
  targetUrl: string;
  authDomain?: string;
  username: string;
  password: string;
  vus: number;
  duration: string;
  rampUp: string;
  postLoginUrls?: string[];
  loginFields?: {
    username: string;
    password: string;
  };
  aspnetMode?: boolean;
}

// ─── Test Record (from DB) ──────────────────
export interface TestRecord {
  id: number;
  target_url: string;
  auth_domain?: string;
  username: string;
  vus: number;
  duration: string;
  ramp_up: string;
  post_login_urls?: string;
  login_fields?: string;
  aspnet_mode?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  started_at?: string;
  completed_at?: string;
  created_at: string;
  // Joined from results table (for history table)
  avg_response_time?: number;
  p95_response_time?: number;
  error_rate?: number;
  error_count?: number;
  total_requests?: number;
  throughput?: number;
}

// ─── Result Summary ─────────────────────────
export interface ResultSummary {
  id: number;
  test_id: number;
  total_requests: number;
  avg_response_time: number;
  min_response_time: number;
  max_response_time: number;
  p50_response_time: number;
  p90_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  throughput: number;
  error_rate: number;
  error_count: number;
  total_data_received: number;
  total_data_sent: number;
  login_success_rate: number;
  avg_login_duration: number;
  successful_logins: number;
  failed_logins: number;
  raw_summary?: string;
  created_at: string;
}

// ─── Time Series Data ───────────────────────
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface GroupedMetrics {
  [metricName: string]: TimeSeriesPoint[];
}

export interface TestResult {
  summary: ResultSummary;
  metrics: GroupedMetrics;
}

// ─── Saved Config ───────────────────────────
export interface SavedConfig {
  id: number;
  name: string;
  config: Partial<TestConfig>;
  created_at: string;
  updated_at: string;
}

// ─── WebSocket Messages ─────────────────────
export interface WsMessage {
  type: 'connected' | 'log' | 'metric' | 'progress' | 'complete';
  testId: string;
  data?: any;
  timestamp: string;
  exitCode?: number;
}

export interface ProgressData {
  percentage?: number;
  currentVUs?: number;
  maxVUs?: number;
  requestsPerSec?: number;
  avgResponseTime?: number;
  errorCount?: number;
  elapsedTime?: string;
  completedIterations?: number;
}

// ─── Dry Run Response ───────────────────────
export interface DryRunResponse {
  success: boolean;
  message: string;
  output: string;
}
