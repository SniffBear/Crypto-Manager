/**
 * Canonical wallet context.
 *
 * DESIGN.md §12 — "There must be one authoritative selected-wallet state.
 * Do not let each screen maintain a separate wallet selector state."
 *
 * `selectedWalletId === null` means ALL WALLETS. Every wallet-aware screen
 * (Home, Wallets, Portfolio, Assets, Activity, Receive, Alerts, Risk,
 * Intelligence, Accounting, Execution) reads this one store.
 */

import { create } from 'zustand';

export const ALL_WALLETS = null;

type WalletContextState = {
  /** null === ALL WALLETS */
  selectedWalletId: string | null;
  /** Set when the selection is pinned by a deep link / detail screen. */
  selectionOrigin: 'global' | 'scoped';
  select: (walletId: string | null) => void;
  selectAll: () => void;
  clearScope: () => void;
};

export const useWalletContext = create<WalletContextState>((set) => ({
  selectedWalletId: ALL_WALLETS,
  selectionOrigin: 'global',
  select: (walletId) => set({ selectedWalletId: walletId, selectionOrigin: 'global' }),
  selectAll: () => set({ selectedWalletId: ALL_WALLETS, selectionOrigin: 'global' }),
  clearScope: () => set({ selectionOrigin: 'global' }),
}));

/** True when the current selection narrows results to one wallet. */
export const isScoped = (walletId: string | null) => walletId !== ALL_WALLETS;