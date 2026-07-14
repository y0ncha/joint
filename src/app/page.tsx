import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  Home,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Settings,
  Utensils,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AccentPicker } from "@/components/accent-picker";
import { BrandMark } from "@/components/brand-mark";
import { getCurrentHousehold } from "@/lib/household";
import { redirect } from "next/navigation";

const currency = new Intl.NumberFormat("en-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

const categories = [
  { name: "Home", amount: 4_280, color: "bg-chart-1", width: "100%" },
  { name: "Groceries", amount: 1_420, color: "bg-chart-2", width: "33%" },
  { name: "Eating out", amount: 780, color: "bg-chart-3", width: "18%" },
  { name: "Getting around", amount: 460, color: "bg-chart-4", width: "11%" },
];

const transactions = [
  { title: "Super Pharm", category: "Home & care", amount: -186, icon: Building2 },
  { title: "Monthly salary", category: "Income", amount: 14_800, icon: ArrowDownRight },
  { title: "Wolt", category: "Eating out", amount: -94, icon: Utensils },
];

function NavItem({ active, icon: Icon, label }: { active?: boolean; icon: typeof Home; label: string }) {
  return (
    <button
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-white/65 hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export default async function HomePage() {
  if (!(await getCurrentHousehold())) redirect("/onboarding");

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[2rem] border border-white/40 bg-white/24 shadow-[0_24px_80px_rgba(15,44,55,0.25)] backdrop-blur-sm lg:min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-[92px] shrink-0 flex-col items-center border-r border-white/35 bg-white/28 py-6 backdrop-blur-xl md:flex">
          <BrandMark size={44} />
          <nav className="mt-10 flex flex-col gap-3">
            <NavItem active icon={LayoutDashboard} label="Overview" />
            <NavItem icon={WalletCards} label="Transactions" />
            <NavItem icon={CreditCard} label="Accounts" />
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <NavItem icon={Settings} label="Settings" />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-sm font-semibold text-primary">Y</div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">Joint</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Good evening, Yonatan</h1>
              <p className="mt-1 text-sm text-muted-foreground">A calm view of your shared money.</p>
            </div>
            <div className="flex items-center gap-2">
              <AccentPicker />
              <Button variant="ghost" size="icon" aria-label="Notifications" className="rounded-xl bg-white/55"><Bell /></Button>
              <Button className="hidden rounded-xl px-4 sm:inline-flex"><Plus />Add transaction</Button>
            </div>
          </header>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Badge variant="secondary" className="rounded-full bg-white/65 px-3 py-1.5 text-sm font-medium text-foreground">July 2026 <ChevronDown /></Badge>
            <Button className="rounded-xl sm:hidden" size="icon" aria-label="Add transaction"><Plus /></Button>
          </div>

          <section className="mt-5 grid gap-4 lg:grid-cols-12">
            <Card className="border-white/50 bg-card/90 lg:col-span-6">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Shared balance</p>
                    <p className="mt-3 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">{currency.format(18_420)}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary"><WalletCards className="h-5 w-5" /></div>
                </div>
                <div className="mt-8 flex flex-wrap gap-2 text-sm">
                  <Badge className="rounded-full bg-primary px-3 py-1.5"><ArrowUpRight /> {currency.format(2_160)} this month</Badge>
                  <span className="self-center text-muted-foreground">Available in the shared bank account</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-3">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Income</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(16_400)}</p>
                <div className="mt-5 flex items-center gap-2 text-sm text-positive"><ArrowDownRight className="h-4 w-4" /> On track for July</div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-3">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">Outgoings</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{currency.format(7_940)}</p>
                <div className="mt-5 flex items-center gap-2 text-sm text-negative"><ArrowUpRight className="h-4 w-4" /> 48% of income</div>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-8">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Where your money went</p><h2 className="mt-1 text-lg font-semibold">This month</h2></div><Button variant="ghost" size="icon" aria-label="More chart options"><MoreHorizontal /></Button></div>
                <div className="mt-7 space-y-5">
                  {categories.map((category) => (
                    <div key={category.name}>
                      <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{category.name}</span><span className="font-mono text-muted-foreground">{currency.format(category.amount)}</span></div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${category.color}`} style={{ width: category.width }} /></div>
                    </div>
                  ))}
                </div>
                <p className="sr-only">Category spending: Home 4,280 shekels, Groceries 1,420 shekels, Eating out 780 shekels, Getting around 460 shekels.</p>
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-card/90 lg:col-span-4">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Upcoming card charge</p><h2 className="mt-1 text-lg font-semibold">Amount due</h2></div><CreditCard className="h-5 w-5 text-primary" /></div>
                <p className="mt-7 font-mono text-4xl font-semibold">{currency.format(3_250)}</p>
                <Separator className="my-5" />
                <p className="text-sm leading-6 text-muted-foreground">This is separate from your shared bank balance, so card payments never double-count your spending.</p>
              </CardContent>
            </Card>
          </section>

          <Card className="mt-4 border-white/50 bg-card/90">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Latest activity</p><h2 className="mt-1 text-lg font-semibold">Recent transactions</h2></div><Button variant="ghost" className="rounded-xl">View all</Button></div>
              <div className="mt-5 divide-y divide-border/80">
                {transactions.map(({ title, category, amount, icon: Icon }) => (
                  <div key={title} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="text-sm text-muted-foreground">{category} · Today</p></div>
                    <p className={`font-mono text-sm font-semibold ${amount < 0 ? "text-negative" : "text-positive"}`}>{amount < 0 ? "−" : "+"}{currency.format(Math.abs(amount))}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <nav className="fixed inset-x-3 bottom-3 z-10 flex h-16 items-center justify-around rounded-2xl border border-white/60 bg-white/80 px-3 shadow-lg backdrop-blur-xl md:hidden">
          <NavItem active icon={LayoutDashboard} label="Overview" />
          <NavItem icon={WalletCards} label="Transactions" />
          <NavItem icon={CreditCard} label="Accounts" />
        </nav>
      </div>
    </main>
  );
}
