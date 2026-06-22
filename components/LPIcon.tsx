import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUp,
  Award,
  Banknote,
  Bath,
  BedDouble,
  BookOpen,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Coins,
  FileCheck2,
  FileText,
  GraduationCap,
  Hammer,
  Handshake,
  HardHat,
  Headphones,
  Home,
  HousePlus,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Menu,
  Minus,
  Phone,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrainFront,
  TrendingUp,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";

export type LPIconName =
  | "alert"
  | "arrow-right"
  | "arrow-up"
  | "award"
  | "banknote"
  | "bath"
  | "bed"
  | "book"
  | "building"
  | "calendar"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clipboard"
  | "clock"
  | "coins"
  | "file"
  | "file-check"
  | "graduation"
  | "hammer"
  | "handshake"
  | "hardhat"
  | "headphones"
  | "home"
  | "house-plus"
  | "key"
  | "landmark"
  | "mail"
  | "map-pin"
  | "menu"
  | "minus"
  | "phone"
  | "plus"
  | "scale"
  | "search"
  | "shield"
  | "sparkles"
  | "star"
  | "train"
  | "trending"
  | "user-plus"
  | "wrench"
  | "x";

const ICONS: Record<LPIconName, LucideIcon> = {
  alert: CircleAlert,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  award: Award,
  banknote: Banknote,
  bath: Bath,
  bed: BedDouble,
  book: BookOpen,
  building: Building2,
  calendar: CalendarCheck,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  clipboard: ClipboardCheck,
  clock: Clock,
  coins: Coins,
  file: FileText,
  "file-check": FileCheck2,
  graduation: GraduationCap,
  hammer: Hammer,
  handshake: Handshake,
  hardhat: HardHat,
  headphones: Headphones,
  home: Home,
  "house-plus": HousePlus,
  key: KeyRound,
  landmark: Landmark,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  minus: Minus,
  phone: Phone,
  plus: Plus,
  scale: Scale,
  search: Search,
  shield: ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  train: TrainFront,
  trending: TrendingUp,
  "user-plus": UserPlus,
  wrench: Wrench,
  x: X,
};

type Props = {
  name: LPIconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
};

export default function LPIcon({ name, className, size = 20, strokeWidth = 1.9 }: Props) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={strokeWidth} />;
}
