---
name: Terminal Vault
colors:
  surface: '#11151A'
  surface-dim: '#111317'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2d'
  surface-container-highest: '#333538'
  on-surface: '#e2e2e6'
  on-surface-variant: '#c5c5d8'
  inverse-surface: '#e2e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#8e8fa1'
  outline-variant: '#444655'
  surface-tint: '#bac3ff'
  primary: '#bac3ff'
  on-primary: '#001f90'
  primary-container: '#7287ff'
  on-primary-container: '#001a7f'
  inverse-primary: '#2d4ce2'
  secondary: '#a9c7ff'
  on-secondary: '#003063'
  secondary-container: '#0464c3'
  on-secondary-container: '#d9e4ff'
  tertiary: '#cdbdff'
  on-tertiary: '#352369'
  tertiary-container: '#9786d1'
  on-tertiary-container: '#2e1c62'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dee0ff'
  primary-fixed-dim: '#bac3ff'
  on-primary-fixed: '#00105b'
  on-primary-fixed-variant: '#002fc9'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#a9c7ff'
  on-secondary-fixed: '#001b3d'
  on-secondary-fixed-variant: '#00468c'
  tertiary-fixed: '#e7deff'
  tertiary-fixed-dim: '#cdbdff'
  on-tertiary-fixed: '#1f0954'
  on-tertiary-fixed-variant: '#4b3b81'
  background: '#111317'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
  surface-elevated: '#171C22'
  surface-hover: '#1D232B'
  border: '#29313A'
  border-strong: '#39434E'
  text-primary: '#F3F6F8'
  text-secondary: '#A9B3BE'
  text-muted: '#737E89'
  primary-hover: '#3E55D0'
  accent-muted: rgba(79, 107, 255, 0.12)
  success: '#2DBE7F'
  success-muted: rgba(45, 190, 127, 0.12)
  warning: '#E5A93D'
  warning-muted: rgba(229, 169, 61, 0.12)
  danger: '#E25555'
  danger-muted: rgba(226, 85, 85, 0.12)
  info: '#5B9DFF'
  info-muted: rgba(91, 157, 255, 0.12)
  stale: '#8D7CC7'
  stale-muted: rgba(141, 124, 199, 0.12)
typography:
  display:
    fontFamily: Roboto Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Roboto Mono
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: '0'
  body-default:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-medium:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 15px
    letterSpacing: 0.01em
  mono-lg:
    fontFamily: Roboto Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  mono-base:
    fontFamily: Roboto Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: '0'
  mono-sm:
    fontFamily: Roboto Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.25rem
  space-2xl: 1.5rem
  space-3xl: 2rem
---

## Brand & Style

This design system establishes an institutional, developer-grade custody terminal for mission-critical digital asset verification and execution. The brand voice is austere, technical, reliable, and mathematically deterministic. It strips away retail crypto tropes—such as neon gradients, meme-driven confetti, playful roundings, and speculative hype—in favor of an unyielding operational command center designed for sustained professional oversight.

The visual style blends **Brutalist discipline** with **High-Contrast Terminal Modernism**:
- Deep obsidian and charcoal surfaces paired with high-contrast, razor-sharp borders.
- An absolute refusal of synthetic animations or bouncy micro-interactions; every visual update corresponds to verifiable on-chain state changes.
- Immediate distinction between proportional descriptive content and fixed-width monospaced metrics, ensuring zero layout shift across live RPC and WebSocket data streams.
- Rigorous state visibility where unresolved, cached, or degraded data is explicitly demarcated rather than hidden or simulated.

## Colors

The system uses an immutable dark canvas foundation (`#0B0D10`). Color is treated strictly as functional telemetry and state signaling rather than passive ornament.

### Canvas & Structural Tones
- **Background (`#0B0D10`)**: The foundational void; an ultra-low-luminosity obsidian that anchors dense data tables and reduces eye strain during multi-hour surveillance.
- **Surface (`#11151A`)**: Baseline container plane for panels, cards, data grids, and persistent toolbars.
- **Surface Elevated (`#171C22`)**: First-tier elevation for modals, bottom sheets, context menus, and active command palettes.
- **Surface Hover (`#1D232B`)**: Immediate visual feedback for interactive list items, focused controls, and table rows.
- **Border (`#29313A`)**: Crisp structural division between data columns, headers, and modules.
- **Border Strong (`#39434E`)**: High-contrast boundary applied to active input borders, keyboard focus rings, and prioritized containers.

### Typography Hierarchy
- **Text Primary (`#F3F6F8`)**: Maximum legibility for core asset figures, key hashes, and critical headers.
- **Text Secondary (`#A9B3BE`)**: Balanced contrast for table column headers, metadata descriptors, and key-value labels.
- **Text Muted (`#737E89`)**: Contextual footnotes, network slot counts, timestamps, and inactive iconography.

### Semantic Telemetry
- **Primary Accent (`#4F6BFF`)**: Controlled indigo reserved strictly for primary execution intents (e.g., signing payloads, confirming broadcasts, authorizing transactions).
- **Success (`#2DBE7F`)**: Cryptographic signature verified, healthy RPC latency (&lt;150ms), and balance credits. Never used simply for speculative market green.
- **Warning (`#E5A93D`)**: Degraded RPC quorum, fee spikes, high slippage, or pending timelocks.
- **Danger (`#E25555`)**: Critical execution failures, instruction simulation reversion, private key exposure prompts, and balance debits.
- **Stale / Cached (`#8D7CC7`)**: Dedicated lavender token indicating out-of-sync block headers, cached RPC state, or delayed WebSocket feeds to prevent assumptions of real-time finality.

## Typography

The typographic hierarchy enforces a disciplined division between prose chrome (`Inter`) and tabular data streams (`Roboto Mono`).

### Dual-Font Application Rules
- **Proportional Engine (`Inter`)**: Governs high-level screen headings, explanatory documentation, navigation links, and structural form labels. It provides a sharp, neutral grotesque frame that does not compete with quantitative content.
- **Monospaced System (`Roboto Mono`)**: Mandatory for all variable numbers, token balances, transaction signatures, Solana public keys, compute units, gas fees, and RPC telemetry. Fixed character widths eliminate horizontal layout shifting and grid jitter during rapid state updates.

### Layout Shift Prevention & Formatting
- All cryptographic keys must be anchored to `Roboto Mono`. When displaying collapsed addresses, enforce 4-character leading and trailing strings (e.g., `7xKX...3b4j`) with fixed horizontal boundaries.
- Unresolved or pending metrics must never default to `0.00` or blank space; render three fixed-width dashes (`---`) to indicate awaiting consensus without layout resizing.
- `label-caps` uses explicit uppercase casing and a `0.04em` tracking boost to maximize scan efficiency across dense data columns.

## Layout & Spacing

The layout is grounded in a compact 4px mathematical rhythm optimized for information density, fast visual indexing, and zero dead space.

### Structural Grid & Shell Architecture
- **Desktop (1024px+)**: 12-column fluid grid containing a persistent 240px navigation sidebar, a central flexible asset workspace (minimum 640px), and an optional 360px contextual telemetry panel. Element gutters stay fixed at `1rem` (16px) with screen margins of `1.5rem` to `2rem`.
- **Tablet (768px – 1023px)**: Adaptive 8-column layout with a collapsible icon-only rail and dual-panel split views for transaction queues and simulation sidecars.
- **Mobile (Under 768px)**: Single-column vertical stream anchored by `1rem` safe-area canvas margins. Modals compress into anchored bottom sheets, and wide financial tables scroll horizontally (`overflow-x: auto`) rather than breaking column fidelity.

### Spacing Philosophy
- Whitespace is treated as an operational separation mechanism, not an aesthetic cushion. Excessive padding that necessitates manual viewport scrolling is prohibited.
- Table rows follow a rigid 36px height standard, using `space-xs` (4px) to `space-sm` (8px) vertical cell padding and `space-md` (12px) horizontal cell margins.

## Elevation & Depth

This system intentionally rejects blurry drop shadows, heavy layered gradients, and decorative glassmorphism. Visual depth is established through **architectural tonal layering** and **hard perimeter outlines**.

### Tonal Stratification Tiers
- **Layer 0 (Canvas Base)**: `#0B0D10` — The absolute foundation across all screens.
- **Layer 1 (Structural Containers)**: `#11151A` bordered by a 1px continuous line of `#29313A`. Houses asset grids, transaction lists, and telemetry modules.
- **Layer 2 (Elevated Overlays)**: `#171C22` outlined with 1px `#39434E`. Reserved for dropdown panels, secondary nested modules, context actions, and flyouts.
- **Layer 3 (Modal Execution Dialogs)**: `#171C22` resting upon a flat 75% blackened scrim (`rgba(0, 0, 0, 0.75)`). Framed with a 1px `#39434E` structural perimeter.

### Focus & Interactive Depth
Depth transitions occur via perimeter illumination rather than physical projection. When hovering over interactive surfaces, the surface shifts to `#1D232B`, and border contrast snaps to `#39434E` with zero spatial movement or shadow dispersion.

## Shapes

The design system uses a strict **Soft (Level 1)** geometric silhouette. Radii are intentionally tight, technical, and restrained to avoid playful "bubble" aesthetics and preserve screen real estate.

### Shape Assignment Rules
- **Form Controls & Action Buttons (`rounded-sm` / 4px – 6px)**: Inputs, segmented tabs, and buttons maintain crisp, mechanical corners.
- **Cards & Data Modules (`rounded-md` / 8px – 10px)**: Base data containers and asset tables feature subtle corner rounding to retain clear grid definition.
- **Sheets & Modals (`rounded-lg` / 12px – 16px)**: Top corners of mobile bottom sheets and modal dialogs use soft curves to demarcate temporary system states.
- **Status Pills (`rounded-full` / 9999px)**: Reserved solely for small inline state indicators and quorum health badges, preventing confusion with structural interactive buttons.

## Components

### Buttons
- **Primary Action (Sign / Authorize / Confirm)**:
  - Surface: Solid `#4F6BFF` with text in `#F3F6F8` (Font: `Inter`, 13px, weight 600).
  - Hover: `#3E55D0` with a 1px stroke of `#39434E`. Active: Scale down to 0.99.
  - Geometry: Height 36px, horizontal padding 16px, border radius 6px.
- **Secondary / Ghost Action**:
  - Surface: Transparent with 1px border in `#29313A`, text in `#A9B3BE`.
  - Hover: Background `#1D232B`, border `#39434E`, text `#F3F6F8`.
- **Destructive Action (Purge / Revoke / Drain)**:
  - Surface: `rgba(226, 85, 85, 0.08)` fill, 1px border in `#E25555`, text `#E25555`.
  - Hover: `rgba(226, 85, 85, 0.18)`. Requires an intentional hold-to-confirm or secondary dual-step slider.

### Input Fields & Verification Controls
- **Field Anatomy**: Background `#0B0D10` inset into a `#11151A` card surface. Border 1px `#29313A`, radius 6px.
- **Active / Focused State**: Border transitions directly to 1px `#39434E` with an interior or exterior 1px focus highlight in `#4F6BFF`.
- **Numeric & Address Inputs**: Typography strictly set to `Roboto Mono` 13px/18px in `#F3F6F8`. Right accessory area houses an uppercase `label-caps` action (e.g., "MAX", "CLEAR").

### Data Tables & Holdings Rows
- Rows are exactly 36px in height with a 1px bottom border in `#29313A`.
- Alternating row backgrounds are avoided; row hover strictly switches background to `#1D232B`.
- All monetary, token balance, and signature data formatted in `Roboto Mono` with right alignment for numeric columns and left alignment for asset symbols.

### Chips & Telemetry Badges
- **Status Chips**: 20px height, radius 9999px, padding 2px 8px. Typography: `label-caps` 11px.
- **RPC Quorum Indicator**: Monospaced latency value flanked by a 6px circular dot: `#2DBE7F` for &lt;150ms, `#E5A93D` for 150–400ms, and `#E25555` for degraded nodes.
- **Stale Cache Indicator**: Translucent purple chip (`rgba(141, 124, 199, 0.12)`) with a 1px `#8D7CC7` border and `#8D7CC7` label: `CACHED [SLOT +42]`.

### Cards & Modular Panels
- Root containers utilize `#11151A` with a 1px `#29313A` boundary.
- Header sections feature a distinct bottom border in `#29313A`, grouping the module title in `label-caps` (`#A9B3BE`) alongside right-aligned diagnostic counters.
- Padding inside cards is standardized at 16px (`space-lg`) on mobile and 20px on desktop terminals.

### Checkboxes & Radio Selectors
- Sizing: 16px × 16px square (checkbox) with a 3px radius, or 16px circular boundary (radio).
- Default: `#0B0D10` surface with 1px `#29313A` border.
- Selected: `#4F6BFF` fill with a crisp white (#F3F6F8) check mark or centered dot. No soft glow or ambient drop shadow.