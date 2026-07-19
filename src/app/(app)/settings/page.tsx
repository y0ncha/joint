import { logOut } from "@/app/actions/auth";
import { AccentPicker } from "@/components/accent-picker";
import { PartnerAccessControl, type PartnerAccessState } from "@/components/partner-access-control";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChevronRight, LogOut, Palette, UserPlus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function SettingsRow({
  icon: Icon,
  label,
  description,
  value,
  children,
  chevron = false,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  children?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <div data-settings-row className="flex min-h-14 items-center gap-3 py-3">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="min-w-0 shrink-0">{children}</div> : null}
      {value ? <p className="shrink-0 text-sm text-muted-foreground">{value}</p> : null}
      {chevron ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" /> : null}
    </div>
  );
}

export default async function SettingsPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  let partnerState: PartnerAccessState | null = null;

  if (household.role === "owner") {
    const supabase = await createServerSupabaseClient();
    const [{ data: members, error: membersError }, { data: authorization, error: authorizationError }] = await Promise.all([
      supabase.from("household_members").select("role").eq("household_id", household.householdId).order("joined_at"),
      supabase.from("household_allowed_members").select("email").eq("household_id", household.householdId).maybeSingle(),
    ]);

    if (membersError || authorizationError) throw new Error("Unable to load partner access.");

    const hasPartner = (members ?? []).some((member) => member.role === "member");
    if (hasPartner && !authorization) throw new Error("Joined partner authorization is missing.");

    partnerState = authorization
      ? { status: hasPartner ? "joined" : "pending", email: authorization.email }
      : { status: "empty" };
  }
  return (
    <WorkspaceShell title="Settings">
      <div className="mt-6 flex w-full flex-col gap-5">
        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Local visual preferences for this browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70">
              <SettingsRow icon={Palette} label="Accent color">
                <div className="w-[min(22rem,55vw)]">
                  <AccentPicker showLabel={false} />
                </div>
              </SettingsRow>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage this browser session and household access.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70">
              <SettingsRow icon={LogOut} label="Session" description="End this browser session and return to sign in.">
                <form action={logOut}>
                  <Button type="submit" variant="outline" size="sm" className="min-h-11 border-transparent bg-white/55">
                    Log out
                  </Button>
                </form>
              </SettingsRow>
              <SettingsRow icon={UserPlus} label="Partner access" description="Authorize one Google account to share this household." value={household.role === "member" ? "Managed by owner" : undefined}>
                {partnerState ? <PartnerAccessControl state={partnerState} /> : null}
              </SettingsRow>
            </div>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
