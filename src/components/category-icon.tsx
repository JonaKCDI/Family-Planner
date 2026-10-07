import {
  Baby,
  Banknote,
  Bike,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  CreditCard,
  Fuel,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Landmark,
  MoreHorizontal,
  Phone,
  PiggyBank,
  Plane,
  Plug,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Sparkles,
  Tag,
  TrainFront,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon
} from "lucide-react";
import { fallbackCategoryIcon, normalizeCategoryIcon, type CategoryIconKey } from "@/lib/category-icon-options";

const categoryIconMap: Record<CategoryIconKey, LucideIcon> = {
  tag: Tag,
  cart: ShoppingCart,
  utensils: Utensils,
  home: Home,
  car: Car,
  fuel: Fuel,
  train: TrainFront,
  bike: Bike,
  wallet: Wallet,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  receipt: ReceiptText,
  "credit-card": CreditCard,
  return: RotateCcw,
  "heart-pulse": HeartPulse,
  shield: ShieldCheck,
  "graduation-cap": GraduationCap,
  baby: Baby,
  plane: Plane,
  gift: Gift,
  sparkles: Sparkles,
  shirt: Shirt,
  wifi: Wifi,
  phone: Phone,
  plug: Plug,
  hammer: Hammer,
  landmark: Landmark,
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  more: MoreHorizontal
};

export function CategoryIcon({
  icon,
  size = 18,
  strokeWidth = 2.4,
  className
}: {
  icon?: string | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = categoryIconMap[normalizeCategoryIcon(icon)] ?? categoryIconMap[fallbackCategoryIcon];
  return <Icon className={className} size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
