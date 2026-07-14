import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AuthenticatedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims?.sub) redirect("/login");

  return children;
}
