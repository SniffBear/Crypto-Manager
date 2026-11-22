/**
 * Toast queue. One host at the shell root so every screen shares a single
 * toast surface (DESIGN.md §24 — contextual actions surface in sheets and
 * toasts, never page-local banners).
 */

import { create } from 'zustand';

import type { Tone } from '@/design/tokens';

export type Toast = {
  id: string;
  message: string;
  detail?: string;
  tone: Tone;
};

type ToastStore = {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

let counter = 0;
const nextId = () => `toast-${++counter}`;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { ...toast, id: nextId() }].slice(-3) })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Imperative helper so non-component code can raise a toast. */
export const toast = {
  success: (message: string, detail?: string) =>
    useToastStore.getState().show({ message, detail, tone: 'success' }),
  error: (message: string, detail?: string) =>
    useToastStore.getState().show({ message, detail, tone: 'danger' }),
  info: (message: string, detail?: string) =>
    useToastStore.getState().show({ message, detail, tone: 'info' }),
};