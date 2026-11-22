/**
 * SOLANA VAULT — DESIGN TOKENS
 * ─────────────────────────────────────────────────────────────────────────────
 * The single source of truth for every visual value in the application.
 * Per DESIGN.md §27 there must be exactly one source of truth; individual
 * screens must never hardcode colours, spacing, radii or type sizes.
 *
 * Values derive from DESIGN.md:
 *   §8  Typography        §9  Color system      §10 Visual language
 *   §29 Table density     §34 Responsive        §35 Accessibility
 */

/* ─────────────────────────────  COLOR  ─────────────────────────────
 * DESIGN.md §9 — restrained dark neutral foundation + semantic colours.
 * §9 rule: "Never use color alone to convey meaning." Every status
 * colour is therefore always paired with a text label and/or glyph by
 * the components that consume it (see `statusTone` below).
 * ------------------------------------------------------------------ */
export const palette = {
  /* Base neutrals — DESIGN.md §9 "Base palette" (verbatim) */
  background: '#0B0D10',
  surface: '#11151A',
  surfaceElevated: '#171C22',
  surfaceHover: '#1D232B',

  border: '#29313A',
  borderStrong: '#39434E',

  textPrimary: '#F3F6F8',
  textSecondary: '#A9B3BE',
  textMuted: '#737E89',

  /* Accent — DESIGN.md §9: "one restrained cool accent ... a blue/indigo
   * family is appropriate, but avoid neon saturation." */
  accent: '#4F6BFF',
  accentHover: '#6B82FF',
  accentPressed: '#3A54E6',
  accentMuted: '#1E2547',
  onAccent: '#0B0D10',

  /* Semantic states — DESIGN.md §9 "Semantic states" (verbatim) */
  success: '#2DBE7F',
  successMuted: '#12301F',
  warning: '#E5A93D',
  warningMuted: '#332612',
  danger: '#E25555',
  dangerMuted: '#331A1A',
  info: '#5B9DFF',
  infoMuted: '#12243B',
  stale: '#8D7CC7',
  staleMuted: '#221E33',
} as const;

export const colors = {
  /* Page + surface layers — DESIGN.md §10 "Surfaces" */
  page: palette.background,
  surface: palette.surface,
  surfaceElevated: palette.surfaceElevated,
  surfaceHover: palette.surfaceHover,

  /* Foreground */
  text: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textMuted: palette.textMuted,
  textInverse: palette.background,

  /* Lines — one border treatment everywhere (§15) */
  border: palette.border,
  borderStrong: palette.borderStrong,
  separator: palette.border,

  /* Accent */
  accent: palette.accent,
  accentHover: palette.accentHover,
  accentPressed: palette.accentPressed,
  accentMuted: palette.accentMuted,
  onAccent: palette.onAccent,

  /* Semantic */
  success: palette.success,
  successMuted: palette.successMuted,
  warning: palette.warning,
  warningMuted: palette.warningMuted,
  danger: palette.danger,
  dangerMuted: palette.dangerMuted,
  info: palette.info,
  infoMuted: palette.infoMuted,
  stale: palette.stale,
  staleMuted: palette.staleMuted,

  /* Non-semantic helpers */
  overlay: 'rgba(4, 6, 9, 0.72)',
  skeleton: palette.surfaceHover,
} as const;

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'stale';

/** Foreground / background pair for each semantic tone. */
export const toneColors: Record<Tone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: palette.textSecondary, bg: palette.surfaceElevated, border: palette.border },
  accent: { fg: palette.accent, bg: palette.accentMuted, border: palette.accent },
  success: { fg: palette.success, bg: palette.successMuted, border: palette.success },
  warning: { fg: palette.warning, bg: palette.warningMuted, border: palette.warning },
  danger: { fg: palette.danger, bg: palette.dangerMuted, border: palette.danger },
  info: { fg: palette.info, bg: palette.infoMuted, border: palette.info },
  stale: { fg: palette.stale, bg: palette.staleMuted, border: palette.stale },
};

/* ────────────────────────────  SPACING  ────────────────────────────
 * 4pt base. DESIGN.md §18 makes breathing room a HIGH PRIORITY, so the
 * scale is intentionally generous at the upper end and page gutters are
 * enforced centrally by PageContainer rather than per screen.
 * ------------------------------------------------------------------ */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  huge: 32,
  giant: 40,
  massive: 48,
  vast: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

/* ─────────────────────────────  RADII  ─────────────────────────────
 * DESIGN.md §10 recommended ranges:
 *   Small control 6–8 · Card 10–12 · Modal/sheet 14–16 · Panel 16–20
 * ------------------------------------------------------------------ */
export const radii = {
  none: 0,
  control: 8,
  card: 12,
  sheet: 16,
  panel: 20,
  pill: 999,
} as const;

/* ──────────────────────────  TYPOGRAPHY  ──────────────────────────
 * DESIGN.md §8 — global type hierarchy. `mono` is used for every
 * balance / price / percentage / fee / amount / address / mint /
 * signature / hash / id / slot / RPC diagnostic (§8, §13 numeric
 * system). All other variants use the proportional sans.
 * ------------------------------------------------------------------ */
export const fontFamily = {
  sans: undefined, // platform default proportional sans
  mono: 'Roboto Mono',
} as const;

export const monoFamily = {
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
  web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export type TypeVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'label'
  | 'caption'
  | 'mono'
  | 'monoLarge'
  | 'monoSmall'
  | 'overline';

type TypeSpec = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing: number;
  mono?: boolean;
  textTransform?: 'uppercase';
};

/**
 * DESIGN.md §8: "Avoid oversized typography. A large portfolio total may be
 * prominent, but it should not consume most of the screen." — `display` is
 * deliberately capped at 34 rather than the 40–48 typical of dashboard kits.
 */
export const typography: Record<TypeVariant, TypeSpec> = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5, mono: true },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.2 },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '600', letterSpacing: -0.1 },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0, mono: true },
  monoLarge: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: 0, mono: true },
  monoSmall: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0, mono: true },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
};

/* ──────────────────────────  ELEVATION  ──────────────────────────
 * Dark UI: elevation is expressed through surface lightness + a soft
 * ambient shadow rather than heavy drop shadows (DESIGN.md §10 avoid
 * list — "excessive glassmorphism", decorative effects).
 * ------------------------------------------------------------------ */
export const elevation = {
  none: {},
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  bar: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

/* ───────────────────  LAYOUT / CHROME CONSTANTS  ───────────────────
 * The application chrome is fixed. Per the refactor contract the App
 * Bar, Bottom Navigation and page gutters are identical on every
 * authenticated screen, so their metrics live here and are consumed by
 * the single AppShell rather than being re-declared per page.
 * ------------------------------------------------------------------ */
export const layout = {
  /** GlobalAppBar total height, excluding the status-bar inset. */
  appBarHeight: 56,
  /** Second context row inside the App Bar (network / vault state). */
  appBarContextHeight: 32,
  /** GlobalBottomNavigation height, excluding the safe-area inset. */
  bottomNavHeight: 60,
  /** DESIGN.md §10/§18 — content must never touch the screen edge. */
  pagePadding: spacing.xl,
  pagePaddingWide: spacing.xxxl,
  /** Space reserved under content so the bottom nav never covers it. */
  contentBottomInset: spacing.massive,
  /** DESIGN.md §34 — large displays get a centred, bounded measure. */
  maxContentWidth: 720,
  /** DESIGN.md §34 — tablet/desktop switch to a navigation rail. */
  railBreakpoint: 900,
  railWidth: 232,
  /** DESIGN.md §35 — adequate touch targets. */
  minTouchTarget: 44,
  /** DESIGN.md §29 — comfortable, never microscopic, table rows. */
  tableRowHeight: 52,
  tableHeaderHeight: 40,
  listRowHeight: 64,
} as const;

/* ───────────────────────────  MOTION  ───────────────────────────
 * DESIGN.md §10 avoid list — "decorative animation". Short, functional
 * durations only.
 * ------------------------------------------------------------------ */
export const duration = {
  instant: 90,
  fast: 150,
  normal: 220,
  sheet: 280,
} as const;

/* ───────────────────  PLATFORM MONO FALLBACK  ─────────────────── */
export const monoFontFor = (platform: string): string => {
  if (platform === 'ios') return monoFamily.ios;
  if (platform === 'android') return monoFamily.android;
  if (platform === 'web') return monoFamily.web;
  return monoFamily.default;
};

export const design = {
  palette,
  colors,
  toneColors,
  spacing,
  radii,
  typography,
  fontFamily,
  elevation,
  layout,
  duration,
} as const;

export type Design = typeof design;