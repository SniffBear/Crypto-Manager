/**
 * Icon resolution.
 *
 * Navigation config and menu config reference icons by string key so the
 * information-architecture file stays free of JSX. This is the only place
 * that maps a key to a Lucide component, which keeps the icon set
 * consistent (DESIGN.md §12 / §35: icons always carry accessible labels).
 */

import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  Bookmark,
  BookOpen,
  Coins,
  Compass,
  Cpu,
  Filter,
  FlaskConical,
  History,
  LayoutGrid,
  type LucideIcon,
  Menu as MenuIcon,
  Plug,
  Receipt,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Target,
  Wallet,
  type LucideProps,
} from 'lucide-react-native';

const REGISTRY: Record<string, LucideIcon> = {
  activity: Activity,
  alert: AlertTriangle,
  archive: Archive,
  bell: Bell,
  bookmark: Bookmark,
  book: BookOpen,
  coins: Coins,
  compass: Compass,
  cpu: Cpu,
  filter: Filter,
  flask: FlaskConical,
  history: History,
  menu: MenuIcon,
  plug: Plug,
  receipt: Receipt,
  refresh: RefreshCw,
  search: Search,
  server: Server,
  settings: Settings,
  shield: Shield,
  target: Target,
  terminal: Cpu,
  vault: Shield,
  wallets: Wallet,
};

export function resolveIcon(key: string): LucideIcon {
  return REGISTRY[key] ?? LayoutGrid;
}

export function Icon({
  name,
  ...props
}: { name: string } & LucideProps): React.ReactElement {
  const Component = resolveIcon(name);
  return <Component {...props} />;
}