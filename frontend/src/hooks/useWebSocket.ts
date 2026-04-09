import { useState, useEffect, useCallback, useRef } from 'react';
import { WsMessage } from '../types';

interface UseWebSocketOptions {
  testId: number | string;
  onMessage?: (msg: WsMessage) => void;
  onLog?: (log: string) => void;
  onProgress?: (data: any) => void;
  onComplete?: (exitCode: number | null) => void;
}

export function useWebSocket({ testId, onMessage, onLog, onProgress, onComplete }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/test/${testId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        onMessage?.(msg);

        switch (msg.type) {
          case 'log':
            setLogs(prev => [...prev.slice(-500), msg.data]); // Keep last 500 lines
            onLog?.(msg.data);
            break;
          case 'progress':
            setProgress((prev: Record<string, any> | null) => ({ ...(prev || {}), ...(msg.data || {}) }));
            onProgress?.(msg.data);
            break;
          case 'complete':
            onComplete?.(msg.exitCode ?? null);
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect with backoff (max 5 attempts)
      if (reconnectRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 10000);
        reconnectRef.current++;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [testId, onMessage, onLog, onProgress, onComplete]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    isConnected,
    logs,
    progress,
    clearLogs,
  };
}
