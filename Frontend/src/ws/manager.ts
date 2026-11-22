/**
 * WebSocket event manager.
 *
 * A single socket for the whole application (DESIGN.md §40 — no duplicate
 * subscriptions). Events are validated, mapped to the affected query keys
 * and invalidated individually; payload data is never mirrored into global
 * state, which keeps high-frequency updates off the React render path.
 *
 * Source: Backend/backend/main.py → WS /ws/events; first frame is { type: 'auth', token }.
 * Session credentials are deliberately excluded from URLs and query strings.
 */

import { AppState as RNAppState } from 'react-native';
import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { API_BASE_URL, getSessionToken } from '@/api/client';
import { queryKeys } from '@/api/keys';
import { useConnectionStore } from '@/stores/connection';

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1_000;

export function toWebSocketUrl(): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws/events`;
}

export function createEventManager(queryClient: QueryClient, getToken: () => string | null) {
  let socket: WebSocket | null = null;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;
  let started = false;

  const clearTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  /** Map a validated event onto the narrowest set of queries it affects. */
  function invalidate(kind: string) {
    switch (kind) {
      case 'connected':
        useConnectionStore.getState().setState('connected');
        return;
      case 'alert.created':
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadAlertCount });
        return;
      case 'execution.pending':
      case 'sync.activity':
        useConnectionStore.getState().setSyncing(kind === 'sync.activity');
        queryClient.invalidateQueries({ queryKey: ['activity'] });
        if (kind === 'execution.pending') {
          queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
        }
        return;
      case 'sync.wallet':
      case 'sync.wallets':
        queryClient.invalidateQueries({ queryKey: ['wallets'] });
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
        return;
      case 'sync.price':
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        queryClient.invalidateQueries({ queryKey: ['portfolio', 'summary'] });
        return;
      case 'sync.risk':
        queryClient.invalidateQueries({ queryKey: queryKeys.risk });
        return;
      case 'vault.locked':
        useConnectionStore.getState().setState('disconnected');
        return;
      default:
        // Unknown event kinds are ignored rather than triggering a broad refetch.
        return;
    }
  }

  function connect() {
    const token = getToken();
    if (!token) {
      useConnectionStore.getState().setState('disconnected');
      return;
    }
    clearTimer();
    intentionalClose = false;
    useConnectionStore.getState().setState(attempt === 0 ? 'reconnecting' : 'reconnecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(toWebSocketUrl());
    } catch {
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      // The backend authenticates the first frame. Do not mark the connection
      // ready until its authenticated `connected` event arrives.
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (message) => {
      useConnectionStore.getState().markEvent();
      try {
        const parsed = JSON.parse(String(message.data)) as { kind?: unknown };
        if (parsed && typeof parsed.kind === 'string') {
          if (parsed.kind === 'connected') attempt = 0;
          invalidate(parsed.kind);
        }
      } catch {
        /* Malformed frames are dropped — never surfaced as an error state. */
      }
    };

    ws.onerror = () => {
      // `onclose` always follows; reconnection is handled there.
    };

    ws.onclose = (event) => {
      socket = null;
      useConnectionStore.getState().setState('disconnected');
      // 4401 is the backend's "session not valid" close code.
      if (event?.code === 4401) return;
      if (!intentionalClose) scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    clearTimer();
    attempt += 1;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(connect, delay);
  }

  function disconnect() {
    intentionalClose = true;
    clearTimer();
    attempt = 0;
    socket?.close();
    socket = null;
    useConnectionStore.getState().setState('disconnected');
  }

  // Reconnect promptly when the app returns to the foreground.
  const subscription = RNAppState.addEventListener('change', (state) => {
    if (state === 'active' && started && !socket) {
      attempt = 0;
      connect();
    }
  });

  return {
    start() {
      if (started) return;
      started = true;
      connect();
    },
    stop() {
      started = false;
      disconnect();
      subscription.remove();
    },
  };
}

export type EventManager = ReturnType<typeof createEventManager>;

/* ────────────────────────────  REACT BINDING  ────────────────────────────
 * One manager instance for the app's lifetime, started when a session
 * exists and torn down when the shell unmounts. Screens never touch the
 * socket themselves (DESIGN.md §40).
 * ------------------------------------------------------------------ */
export function useEventSocket(enabled: boolean) {
  const queryClient = useQueryClient();
  const manager = useRef<EventManager | null>(null);

  if (!manager.current) {
    manager.current = createEventManager(queryClient, getSessionToken);
  }

  useEffect(() => {
    if (enabled) manager.current?.start();
  }, [enabled]);

  useEffect(() => {
    return () => {
      manager.current?.stop();
    };
  }, []);
}