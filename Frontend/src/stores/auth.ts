/**
 * Session / vault state.
 *
 * DESIGN.md §36 — the session token lives in memory only. It is never
 * persisted to MMKV, AsyncStorage, SQLite or query persistence, and the
 * in-memory payload is dropped as soon as the vault is locked.
 *
 * The `phase` field is the single authority the root layout uses to decide
 * between the locked shell and the authenticated AppShell.
 */

import { create } from 'zustand';

import { api, ApiError, setSessionToken, getSessionToken } from '@/api/client';
import type { VaultMetadata } from '@/api/types';

export type AuthPhase =
  | 'booting'
  | 'offline'
  | 'needs_setup'
  | 'locked'
  | 'unlocked';

type AuthState = {
  phase: AuthPhase;
  vault: VaultMetadata | null;
  authenticatedSessions: number;
  error: string | null;
  busy: boolean;

  bootstrap: () => Promise<void>;
  setup: (password: string) => Promise<boolean>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
  /** Called when any request returns 401. */
  handleUnauthorized: () => void;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  phase: 'booting',
  vault: null,
  authenticatedSessions: 0,
  error: null,
  busy: false,

  bootstrap: async () => {
    set({ phase: 'booting', error: null });
    try {
      const status = await api.auth.status();
      const hasLocalSession = Boolean(getSessionToken());

      set({
        vault: status.vault,
        authenticatedSessions: status.authenticated_sessions,
        // An unlocked vault on the server does not prove this client owns an
        // authenticated session. Tokens are deliberately memory-only, so an
        // app reload must return to the locked state.
        phase: !status.vault.exists
          ? 'needs_setup'
          : hasLocalSession && !status.vault.locked
            ? 'unlocked'
            : 'locked',
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.userMessage : 'Cannot reach the backend.';
      set({ phase: 'offline', error: message });
    }
  },

  refreshStatus: async () => {
    try {
      const status = await api.auth.status();
      const hasLocalSession = Boolean(getSessionToken());

      set({
        vault: status.vault,
        authenticatedSessions: status.authenticated_sessions,
        phase: !status.vault.exists
          ? 'needs_setup'
          : hasLocalSession && !status.vault.locked
            ? 'unlocked'
            : 'locked',
      });
    } catch {
      /* Keep the last known phase; the connection indicator reports the outage. */
    }
  },

  setup: async (password) => {
    set({ busy: true, error: null });
    try {
      const result = await api.auth.setup(password);
      setSessionToken(result.token);
      set({ vault: result.vault, phase: 'unlocked', busy: false });
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.userMessage : 'Setup failed.';
      set({ error: message, busy: false });
      return false;
    }
  },

  unlock: async (password) => {
    set({ busy: true, error: null });
    try {
      const result = await api.auth.unlock(password);
      setSessionToken(result.token);
      set({ vault: result.vault, phase: 'unlocked', busy: false });
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.userMessage : 'Unlock failed.';
      set({ error: message, busy: false });
      return false;
    }
  },

  lock: async () => {
    set({ busy: true });
    try {
      await api.auth.lock();
    } catch {
      /* Locking locally is still the safe outcome if the call fails. */
    } finally {
      setSessionToken(null);
      set({ phase: 'locked', busy: false, authenticatedSessions: 0 });
    }
  },

  handleUnauthorized: () => {
    if (get().phase === 'unlocked') {
      setSessionToken(null);
      set({ phase: 'locked', error: 'Session expired. Unlock the vault to continue.' });
    }
  },

  clearError: () => set({ error: null }),
}));

/** Convenience selector — whether the authenticated shell should render. */
export const isAuthenticated = (phase: AuthPhase) => phase === 'unlocked';
export const hasSession = () => Boolean(getSessionToken());