/**
 * Accessor for the active page meta.
 *
 * Kept in its own module so `PageContainer` — which only *reads* meta —
 * does not create a circular import with the provider that *writes* it.
 */

import { useContext } from 'react';

import { ShellContext } from './shell-context';

function useShellContextValue() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('Page chrome must be rendered inside <ShellProvider>');
  }
  return context;
}

/** The current page's declared identity, or null before one is declared. */
export function useShellMeta() {
  return useShellContextValue().meta;
}

export function useShellActions() {
  const { openSheet, closeSheet, setMeta } = useShellContextValue();
  return { openSheet, closeSheet, setMeta };
}