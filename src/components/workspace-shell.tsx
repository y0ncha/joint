"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, Settings, Tags, WalletCards, type LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", WalletCards],
  ["/categories", "Categories", Tags],
  ["/settings", "Settings", Settings],
] as const;

const notifications: Array<{ title: string; description: string }> = [];

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

function UserNotificationAvatar({ hasUnreadNotifications = false }: { hasUnreadNotifications?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative mt-auto flex size-11 items-center justify-center rounded-full outline-none transition-shadow duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar className="size-11 border border-white/60 bg-white/70 text-primary">
            <AvatarFallback>Me</AvatarFallback>
            {hasUnreadNotifications ? (
              <AvatarBadge
                aria-label="Unread notifications"
                className="top-0 right-0 bottom-auto size-3.5 bg-primary ring-white"
              />
            ) : null}
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-72 rounded-2xl border-white/70 bg-popover/98 p-4 shadow-[0_18px_42px_rgba(15,44,55,0.22)] backdrop-blur-xl"
      >
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        {notifications.length ? (
          <div className="max-h-[min(18rem,calc(100vh-7rem))] overflow-y-auto pr-1">
            <div role="list" aria-label="Notifications" className="flex flex-col gap-2">
              {notifications.map((notification) => (
                <div key={notification.title} role="listitem" className="rounded-xl bg-popover p-3 text-sm shadow-sm ring-1 ring-border/60">
                  <p className="font-medium">{notification.title}</p>
                  <p className="mt-1 text-muted-foreground">{notification.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No unread household updates.</p>
        )}
      </PopoverContent>
    </Popover>
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
          <UserNotificationAvatar />
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
          {children}
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
