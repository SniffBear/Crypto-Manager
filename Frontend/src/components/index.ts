/**
 * The component library — one import surface.
 *
 * Screens import from `@/components` and nothing else. If a page could reach
 * into `react-native` for a raw `Pressable` or a raw colour, "one component
 * library" would only be a naming convention; keeping the barrel as the sole
 * entry point makes the constraint legible.
 *
 * Anything exported here is the canonical implementation. There is no
 * per-screen variant.
 */

/* ── Layout primitives ── */
export { Text } from './primitives/Text';
export {
  Button,
  IconButton,
  Card,
  Section,
  Divider,
  Input,
  Chip,
  Row,
  Stack,
  Spacer,
  KeyValue,
  TONE_SKIN,
  type ButtonVariant,
  type ButtonSize,
  type ButtonProps,
  type IconButtonProps,
  type CardProps,
  type InputProps,
  type ChipProps,
} from './primitives';

/* ── Status + icons ── */
export { StatusBadge, StatusDot, type StatusBadgeProps } from './StatusBadge';
export { Icon, resolveIcon } from './Icon';

/* ── Display utilities ── */
export { CopyButton, AddressDisplay, TokenIcon, WalletAvatar, type AddressDisplayProps } from './utility';

/* ── Data presentation ── */
export * from './data';
export * from './DataTable';

/* ── Overlays + feedback ── */
export { BottomSheet, type BottomSheetProps } from './feedback/BottomSheet';
export { Modal, type ModalProps } from './feedback/Modal';
export { ConfirmationDialog, type ConfirmationDialogProps } from './feedback/ConfirmationDialog';
export { ConfirmationProvider, useConfirmDialog, type ConfirmRequest } from './feedback/confirmation-context';
export { ToastHost } from './feedback/Toast';
export {
  Skeleton,
  SkeletonRow,
  SkeletonList,
  LoadingState,
  EmptyState,
  ErrorState,
  UnsupportedState,
  NoticeBanner,
} from './feedback/states';

/* ── Persistent context controls ── */
export { ConnectionIndicator, ConnectionDot, resolveConnectionStatus } from './context/ConnectionIndicator';
export { AlertIndicator } from './context/AlertIndicator';
export { WalletSelector, useSelectedWallet } from './context/WalletSelector';

/* ── The shell (chrome) ── */
export { AppShell } from './chrome/AppShell';
export { GlobalAppBar } from './chrome/GlobalAppBar';
export { GlobalBottomNavigation } from './chrome/GlobalBottomNavigation';
export { GlobalMenu } from './chrome/GlobalMenu';
export { AllTabs, buildTabGroups, type TabGroup } from './chrome/AllTabs';
export { PageContainer, type PageContainerProps } from './chrome/PageContainer';
export { PageHeader, SectionHeader, Breadcrumbs, BreadcrumbLinks, PRODUCT_NAME } from './chrome/PageHeader';
export { ShellProvider, usePageMeta, useSheet, type PageMeta, type Crumb, type SheetRequest } from './chrome/shell-context';
export { useShellMeta, useShellActions } from './chrome/useShellMeta';