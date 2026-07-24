import { NextResponse } from "next/server";

import { ensurePartnerMembership } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/login?error=oauth_callback", url.origin));

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const rawEmail = data?.claims?.email;
  const provider = data?.claims?.app_metadata?.provider;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (provider === "google" && typeof userId === "string" && userId && email) {
    const membership = await ensurePartnerMembership(supabase, { userId, email });
    if (membership !== "unmatched") return NextResponse.redirect(new URL("/setup/card", url.origin));
  }

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=access_denied", url.origin));
}
