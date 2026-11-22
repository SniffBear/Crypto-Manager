/**
 * Confirmation host.
 *
 * Exactly one confirmation dialog exists in the application. It is mounted by
 * `AppShell` and driven by `useConfirmDialog()`, the same way the single sheet
 * host is driven by `useSheet()`. This is what makes "confirmation language
 * never varies by screen" (DESIGN.md §3.2) true by construction: a screen
 * cannot render its own dialog, it can only request one.
 *
 *     const { confirm } = useConfirmDialog();
 *     if (await confirm({ title, message, tone: 'danger' })) { … }
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { ConfirmationDialog } from './ConfirmationDialog';

export type ConfirmRequest = {
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'accent';
  /** Requires the user to type this exact phrase before confirming. */
  requireTypedPhrase?: string;
};

type ConfirmationContextValue = {
  request: (options: ConfirmRequest) => Promise<boolean>;
};

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    setRequest(null);
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(value);
  }, []);

  const ask = useCallback((options: ConfirmRequest) => {
    // A second request supersedes the first; the first resolves `false` so a
    // caller awaiting it can never hang.
    resolver.current?.(false);
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo<ConfirmationContextValue>(() => ({ request: ask }), [ask]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        visible={request !== null}
        title={request?.title ?? ''}
        message={request?.message ?? ''}
        details={request?.details}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        destructive={request?.tone !== 'accent'}
        requireTypedPhrase={request?.requireTypedPhrase}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmationContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used inside <ConfirmationProvider>');
  }
  return { confirm: context.request };
}