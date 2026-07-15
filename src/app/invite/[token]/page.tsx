import { redirect } from "next/navigation";

import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const household = await getCurrentHousehold();
  if (household) redirect("/");

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub) redirect(`/onboarding?token=${encodeURIComponent(token)}`);

  const next = `/onboarding?token=${encodeURIComponent(token)}`;
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
