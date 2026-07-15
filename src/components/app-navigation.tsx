import Link from "next/link";

const links = [["/", "Dashboard"], ["/transactions", "Transactions"], ["/accounts", "Accounts"], ["/categories", "Categories"], ["/settings", "Settings"]] as const;

export function AppNavigation() {
  return <nav aria-label="Primary navigation" className="mt-6 flex flex-wrap gap-3 text-sm">{links.map(([href, label]) => <Link key={href} href={href} className="min-h-11 rounded-md px-2 py-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">{label}</Link>)}</nav>;
}
