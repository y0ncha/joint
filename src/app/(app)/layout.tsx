import { redirect } from "next/navigation";

import { getHouseholdForUser } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AuthenticatedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();

  const userId = claims?.claims?.sub;
  if (!userId) {
    redirect("/login");
    return null;
  }

  if (!await getHouseholdForUser(supabase, userId)) {
    redirect("/auth/access-denied");
    return null;
  }

  return children;
}
