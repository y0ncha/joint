"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { LayoutDashboard, Settings, Tags, WalletCards, type LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", WalletCards],
  ["/categories", "Categories", Tags],
  ["/settings", "Settings", Settings],
] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavigationItem({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname() ?? "/";
  const active = isActivePath(pathname, href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={label}
      href={href}
      prefetch
      className={cn(
        "flex size-11 items-center justify-center rounded-2xl transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-white/65 hover:text-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Link>
  );
}

export function WorkspaceShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[2rem] border border-white/40 bg-white/24 shadow-[0_24px_80px_rgba(15,44,55,0.25)] backdrop-blur-sm lg:min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-[92px] shrink-0 flex-col items-center border-r border-white/35 bg-white/28 px-0 pt-6 pb-6 backdrop-blur-xl md:flex lg:pt-8 lg:pb-8">
          <BrandMark size={44} />
          <nav aria-label="Primary navigation" className="mt-10 flex flex-col gap-3">
            {navigation.map(([href, label, Icon]) => (
              <NavigationItem key={href} href={href} label={label} icon={Icon} />
            ))}
          </nav>
        </aside>
        <section className="min-w-0 flex-1 p-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-6 lg:p-8 animate-in fade-in-0 duration-150 ease-out">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Joint</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </header>
          <div data-workspace-content className="w-full">
            {children}
          </div>
        </section>
        <nav aria-label="Primary navigation" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] flex h-16 items-center justify-around rounded-[calc(2rem-0.75rem)] border border-white/60 bg-white/80 px-3 shadow-lg backdrop-blur-xl md:hidden">
          {navigation.map(([href, label, Icon]) => (
            <NavigationItem key={href} href={href} label={label} icon={Icon} />
          ))}
        </nav>
      </div>
    </main>
  );
}
