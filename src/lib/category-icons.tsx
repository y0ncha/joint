import type { ComponentType, SVGProps } from "react";
import {
  Baby,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Car,
  CircleDollarSign,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Hotel,
  Landmark,
  Lightbulb,
  PawPrint,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Users,
  WalletCards,
  Wifi,
  Wrench,
} from "lucide-react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export const categoryIcons = [
  ["tag", "Other", Tag],
  ["shopping-basket", "Groceries", ShoppingBasket],
  ["utensils", "Dining", Utensils],
  ["coffee", "Coffee", Coffee],
  ["home", "Home", Home],
  ["car", "Car", Car],
  ["bus", "Transit", Bus],
  ["fuel", "Fuel", Fuel],
  ["heart-pulse", "Health", HeartPulse],
  ["pill", "Pharmacy", Pill],
  ["dumbbell", "Fitness", Dumbbell],
  ["graduation-cap", "Education", GraduationCap],
  ["book-open", "Books", BookOpen],
  ["gift", "Gifts", Gift],
  ["shirt", "Clothing", Shirt],
  ["gamepad-2", "Entertainment", Gamepad2],
  ["plane", "Travel", Plane],
  ["hotel", "Stay", Hotel],
  ["smartphone", "Phone", Smartphone],
  ["wifi", "Internet", Wifi],
  ["lightbulb", "Utilities", Lightbulb],
  ["wrench", "Repairs", Wrench],
  ["shield-check", "Insurance", ShieldCheck],
  ["paw-print", "Pets", PawPrint],
  ["baby", "Children", Baby],
  ["users", "Family", Users],
  ["landmark", "Taxes", Landmark],
  ["receipt", "Bills", Receipt],
  ["wallet-cards", "Wallet", WalletCards],
  ["banknote", "Cash", Banknote],
  ["circle-dollar-sign", "Income", CircleDollarSign],
  ["briefcase-business", "Work", BriefcaseBusiness],
  ["hand-coins", "Savings", HandCoins],
  ["sparkles", "Personal", Sparkles],
] as const satisfies readonly (readonly [string, string, Icon])[];

export type CategoryIconName = (typeof categoryIcons)[number][0];

const iconsByName = new Map<string, { label: string; icon: Icon }>(categoryIcons.map(([name, label, icon]) => [name, { label, icon }]));

export function isCategoryIcon(value: FormDataEntryValue | null): value is CategoryIconName {
  return typeof value === "string" && iconsByName.has(value);
}

export function categoryIcon(name: string | null | undefined) {
  return iconsByName.get(name ?? "tag")?.icon ?? Tag;
}
