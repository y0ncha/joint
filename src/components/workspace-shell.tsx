"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { LayoutDashboard, PieChart, Settings, Tags, Target, WalletCards, WandSparkles, type LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getProfileInitials } from "@/lib/profile";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", WalletCards],
  ["/bills-groceries", "Bills & Groceries", PieChart],
  ["/budgets-goals", "Budgets & Goals", Target],
  ["/settings", "Settings", Settings],
] as const;

const sidebarNavigation = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", WalletCards],
  ["/bills-groceries", "Bills & Groceries", PieChart],
  ["/budgets-goals", "Budgets & Goals", Target],
  ["/categories", "Categories", Tags],
  ["/automations", "Automations", WandSparkles],
  ["/settings", "Settings", Settings],
] as const;

type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;
type ProfileClient = {
  auth: Pick<BrowserSupabaseClient["auth"], "getClaims">;
  from: BrowserSupabaseClient["from"];
};

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export async function loadVerifiedProfileName(client: ProfileClient) {
  const { data } = await client.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return "";

  const key = `joint-profile-name:${userId}`;
  const cached = localStorage.getItem(key);
  if (cached !== null) return cached;

  const { data: profile } = await client.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const name = profile?.full_name?.trim() ?? "";
  localStorage.setItem(key, name);
  return name;
}

export function ProfileInitialAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-11">
      <AvatarFallback>{getProfileInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function CachedProfileInitialAvatar() {
  const [name, setName] = useState("");

  useEffect(() => {
    void loadVerifiedProfileName(createBrowserSupabaseClient()).then(setName);
    const refreshName = () => void loadVerifiedProfileName(createBrowserSupabaseClient()).then(setName);
    window.addEventListener("joint-profile-name-updated", refreshName);
    return () => window.removeEventListener("joint-profile-name-updated", refreshName);
  }, []);

  return <ProfileInitialAvatar name={name} />;
}

function NavigationItem({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname() ?? "/";
  const active = isActivePath(pathname, href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={label}
      href={href}
      className={cn(
        "flex size-11 touch-manipulation items-center justify-center rounded-2xl transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/65 hover:text-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Link>
  );
}

export type WorkspacePageProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  opaqueContent?: boolean;
};

export function WorkspaceChrome({ children, profileSlot }: { children: ReactNode; profileSlot: ReactNode }) {
  return (
    <main className="min-h-screen p-0 text-foreground sm:px-5 sm:py-5 lg:px-8 lg:py-8">
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50" href="#workspace-content">
        Skip to page content
      </a>
      <div className="mx-auto flex min-h-screen max-w-[1500px] overflow-hidden bg-white/24 shadow-[0_24px_80px_rgba(15,44,55,0.25)] backdrop-blur-sm sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem] sm:border sm:border-white/40 lg:min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-[92px] shrink-0 flex-col items-center border-r border-white/35 bg-white/28 px-0 pt-6 pb-6 backdrop-blur-xl md:flex lg:pt-8 lg:pb-8">
          <BrandMark size={44} />
          <nav aria-label="Primary navigation" className="mt-10 flex flex-col gap-3">
            {sidebarNavigation.map(([href, label, Icon]) => (
              <NavigationItem key={href} href={href} label={label} icon={Icon} />
            ))}
          </nav>
          <div className="mt-auto">{profileSlot}</div>
        </aside>
        {children}
      </div>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] flex h-16 items-center justify-around rounded-[calc(2rem-0.75rem)] border border-white/60 bg-white/80 px-3 shadow-lg backdrop-blur-xl md:hidden"
      >
        {navigation.map(([href, label, Icon]) => (
          <NavigationItem key={href} href={href} label={label} icon={Icon} />
        ))}
      </nav>
    </main>
  );
}

export function WorkspacePage({ title, description, actions, children, opaqueContent = false }: WorkspacePageProps) {
  return (
    <section
      className={cn(
        "min-w-0 flex-1 p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(9rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-6 lg:p-8",
        opaqueContent && "bg-white/50 backdrop-blur-sm",
      )}
    >
      {title ? (
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-stretch gap-3 pl-1 md:block md:pl-0">
            <span aria-hidden="true" className="block w-1 shrink-0 self-stretch rounded-full bg-primary md:hidden" />
            <div>
              <p className="text-sm font-medium text-primary">Joint</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div id="workspace-content" data-workspace-content className="w-full" tabIndex={-1}>
        {children}
      </div>
    </section>
  );
}
