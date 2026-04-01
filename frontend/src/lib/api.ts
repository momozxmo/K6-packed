import { TestConfig, TestRecord, TestResult, SavedConfig, DryRunResponse } from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  return res.json();
}

// ─── Tests ──────────────────────────────────
export const api = {
  createTest: (config: TestConfig) =>
    request<TestRecord>('/tests', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getTests: () =>
    request<TestRecord[]>('/tests'),

  getTest: (id: number) =>
    request<TestRecord>(`/tests/${id}`),

  deleteTest: (id: number) =>
    request<{ message: string }>(`/tests/${id}`, { method: 'DELETE' }),

  stopTest: (id: number) =>
    request<{ message: string }>(`/tests/${id}/stop`, { method: 'POST' }),

  dryRun: (config: Partial<TestConfig>) =>
    request<DryRunResponse>('/tests/dry-run', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  // ─── Results ──────────────────────────────
  getResults: (testId: number) =>
    request<TestResult>(`/results/${testId}`),

  exportJson: (testId: number) =>
    `${API_BASE}/results/${testId}/export/json`,

  exportCsv: (testId: number) =>
    `${API_BASE}/results/${testId}/export/csv`,

  // ─── Configs ──────────────────────────────
  saveConfig: (name: string, config: Partial<TestConfig>) =>
    request<SavedConfig>('/configs', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    }),

  getConfigs: () =>
    request<SavedConfig[]>('/configs'),

  deleteConfig: (id: number) =>
    request<{ message: string }>(`/configs/${id}`, { method: 'DELETE' }),

  // ─── Health ───────────────────────────────
  health: () =>
    request<{ status: string; runningTests: number }>('/health'),
};
