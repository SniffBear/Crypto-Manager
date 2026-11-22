/**
 * Responsive helpers.
 *
 * DESIGN.md §34 — phone-first, but tablets and large displays keep the same
 * information architecture. Only the *presentation* of navigation changes
 * (bottom bar → rail); the destinations never do.
 */

import { useWindowDimensions } from 'react-native';

import { layout } from '@/design/tokens';

export type Breakpoint = 'phone' | 'tablet' | 'large';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= 1100) return 'large';
  if (width >= 700) return 'tablet';
  return 'phone';
}

/** Phones and small tablets use the bottom bar; larger displays get a rail. */
export function useNavigationMode(): 'bar' | 'rail' {
  const { width } = useWindowDimensions();
  return width >= layout.railBreakpoint ? 'rail' : 'bar';
}

/** True when the content column should be centred and width-constrained. */
export function useConstrainedLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= layout.maxContentWidth + layout.pagePaddingWide * 2;
}