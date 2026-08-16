import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/lib/database.types";

function isValidCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return new NextResponse("Server configuration is missing.", { status: 500 });

  const supabase = createClient<Database>(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.rpc("process_due_recurring_transaction_schedules", {});
  if (error) return new NextResponse("Unable to process recurring transactions.", { status: 500 });
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !isValidCount(data.created_count) ||
    !isValidCount(data.blocked_count)
  ) {
    return new NextResponse("Invalid recurring transaction processor result.", { status: 500 });
  }

  return NextResponse.json({ ok: true, createdCount: data.created_count, blockedCount: data.blocked_count });
}
