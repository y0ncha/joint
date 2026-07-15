import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase browser configuration is missing.");
  }

  return createBrowserClient<Database>(url, publishableKey);
}
