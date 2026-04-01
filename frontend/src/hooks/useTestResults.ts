import { useState, useEffect } from 'react';
import { TestResult } from '../types';
import { api } from '../lib/api';

export function useTestResults(testId: number | undefined) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.getResults(testId)
      .then(data => {
        if (!cancelled) setResult(data);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [testId]);

  const refetch = async () => {
    if (!testId) return;
    setLoading(true);
    try {
      const data = await api.getResults(testId);
      setResult(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, refetch };
}
