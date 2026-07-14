import { NextResponse } from "next/server";

import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;

  const destination = new URL(next, origin);
  return destination.origin === origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/login?error=oauth_callback", url.origin));

  const household = await getCurrentHousehold();
  const next = safeNextPath(url.searchParams.get("next"), url.origin);
  const destination = household ? "/" : next ?? "/onboarding";

  return NextResponse.redirect(new URL(destination, url.origin));
}
