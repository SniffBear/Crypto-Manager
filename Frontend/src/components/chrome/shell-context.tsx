/**
 * Shell context.
 *
 * This is the mechanism that makes "one app bar, one bottom nav" enforceable
 * rather than aspirational:
 *
 *  - A screen declares its identity with `usePageMeta(...)`. The single
 *    GlobalAppBar renders it. A screen physically cannot render its own
 *    header, because the shell owns the chrome.
 *  - A screen raises a sheet with `useSheet().open(...)`. The single
 *    BottomSheet host renders it, so wallet pickers, filters and reviews all
 *    share one presentation.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { BottomSheet } from '@/components/feedback/BottomSheet';

/* ─────────────────────────────  PAGE META  ───────────────────────────── */

export type Crumb = {
  label: string;
  /** Present when the crumb is navigable. */
  href?: string;
};

export type PageMeta = {
  /** Page/section context rendered in the App Bar. */
  title: string;
  subtitle?: string;
  /** Shown as a breadcrumb trail under the title where useful. */
  breadcrumbs?: Crumb[];
  /** Trailing slot in the App Bar (e.g. a context action). */
  actions?: React.ReactNode;
  /** Whether this page is wallet-scoped and should offer the selector. */
  showWalletSelector?: boolean;
  /** Allow vertical scrolling of the content column. */
  scrollable?: boolean;
  /** Extra bottom padding, e.g. when a page hosts its own action bar. */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

/* ──────────────────────────────  SHEET  ────────────────────────────── */

export type SheetRequest = {
  title?: string;
  subtitle?: string;
  render: (close: () => void) => React.ReactNode;
  footer?: (close: () => void) => React.ReactNode;
  dismissible?: boolean;
  maxHeightRatio?: number;
};

/* ─────────────────────────────  CONTEXT  ───────────────────────────── */

type ShellContextValue = {
  meta: PageMeta | null;
  setMeta: (meta: PageMeta | null) => void;
  openSheet: (request: SheetRequest) => void;
  closeSheet: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

// Exported for the `useShellMeta` accessor, which keeps PageContainer from
// importing this module's provider.
export { ShellContext };

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMetaState] = useState<PageMeta | null>(null);
  const [sheet, setSheet] = useState<SheetRequest | null>(null);

  const setMeta = useCallback((next: PageMeta | null) => {
    setMetaState(next);
  }, []);

  const openSheet = useCallback((request: SheetRequest) => setSheet(request), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const value = useMemo<ShellContextValue>(
    () => ({ meta, setMeta, openSheet, closeSheet }),
    [meta, setMeta, openSheet, closeSheet],
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <BottomSheet
        visible={Boolean(sheet)}
        onClose={closeSheet}
        title={sheet?.title}
        subtitle={sheet?.subtitle}
        dismissible={sheet?.dismissible ?? true}
        maxHeightRatio={sheet?.maxHeightRatio}
        footer={sheet?.footer ? sheet.footer(closeSheet) : undefined}
        testID="global-sheet"
      >
        {sheet ? sheet.render(closeSheet) : null}
      </BottomSheet>
    </ShellContext.Provider>
  );
}

function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used inside <ShellProvider>');
  }
  return context;
}

export function useSheet() {
  const { openSheet, closeSheet } = useShell();
  return { open: openSheet, close: closeSheet };
}

/**
 * Declare the current page's identity.
 *
 * Called at the top level of a screen. The shell renders the result, so
 * every authenticated page gets an identical App Bar for free.
 */
export function usePageMeta(meta: PageMeta): void {
  const { setMeta } = useShell();
  // Store the live object in a ref so React nodes in `actions` don't need to
  // be serialised for dependency comparison.
  const latest = useRef(meta);
  latest.current = meta;

  const signature = JSON.stringify({
    title: meta.title,
    subtitle: meta.subtitle ?? null,
    breadcrumbs: meta.breadcrumbs ?? null,
    showWalletSelector: meta.showWalletSelector ?? null,
    scrollable: meta.scrollable ?? true,
    bottomInset: meta.bottomInset ?? 0,
  });

  useEffect(() => {
    setMeta(latest.current);
    // `signature` intentionally captures the declarative fields; `actions`
    // is read from the ref at render time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMeta, signature]);

  useEffect(() => {
    return () => setMeta(null);
  }, [setMeta]);
}