/**
 * Realtime connection state.
 *
 * DESIGN.md §38 — quiet, continuous updates. The ConnectionIndicator reads
 * this store so every screen reports the same state with the same
 * component. DESIGN.md §5 — high-frequency events must not push the whole
 * tree; events invalidate specific queries rather than storing payloads.
 */

import { create } from 'zustand';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

type ConnectionStore = {
  state: ConnectionState;
  /** Timestamp of the last event received from the backend. */
  lastEventAt: number | null;
  /** Set when a background sync is in flight. */
  syncing: boolean;
  setState: (state: ConnectionState) => void;
  markEvent: () => void;
  setSyncing: (syncing: boolean) => void;
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  state: 'disconnected',
  lastEventAt: null,
  syncing: false,
  setState: (state) => set({ state }),
  markEvent: () => set({ lastEventAt: Date.now() }),
  setSyncing: (syncing) => set({ syncing }),
}));