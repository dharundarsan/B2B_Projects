import {
  Building2,
  ShoppingBasket,
  Wallet,
  ShieldCheck,
  Map,
  CalendarDays,
  Users,
  LayoutDashboard,
  Wrench,
  Store,
  Megaphone,
  Grid2X2,
  ListChecks,
  ChartNoAxesCombined,
  Settings2,
} from "lucide-react";
const icons = {
  building: Building2,
  basket: ShoppingBasket,
  wallet: Wallet,
  shield: ShieldCheck,
  map: Map,
  calendar: CalendarDays,
  users: Users,
  dashboard: LayoutDashboard,
  wrench: Wrench,
  store: Store,
  notice: Megaphone,
  grid: Grid2X2,
  actions: ListChecks,
  chart: ChartNoAxesCombined,
  settings: Settings2,
};
export function ModuleIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons] ?? Grid2X2;
  return <Icon size={size} />;
}
