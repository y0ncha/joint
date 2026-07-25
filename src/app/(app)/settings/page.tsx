import { logOut } from "@/app/actions/auth";
import { AccentPicker } from "@/components/accent-picker";
import { HouseholdNameSettingsControl } from "@/components/household-name-settings-control";
import { MemberCardSettingsControl } from "@/components/member-card-settings-control";
import { MemberColorSettingsControl } from "@/components/member-color-settings-control";
import { MemberManagementSheet, type PartnerAccessState } from "@/components/partner-access-control";
import { ProfileNameSettingsControl } from "@/components/profile-name-settings-control";
import { SettingsSaveControl } from "@/components/settings-save-control";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentHouseholdContext } from "@/lib/household";
import { ChevronRight, CreditCard, House, LogOut, Palette, UserRound, UsersRound, type LucideIcon } from "lucide-react";
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
      {value ? <p title={value} className="min-w-0 max-w-1/2 shrink truncate text-sm text-muted-foreground">{value}</p> : null}
      {chevron ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" /> : null}
    </div>
  );
}

export default async function SettingsPage() {
  const household = await getCurrentHouseholdContext();
  if (household.status !== "member") return null;
  const [{ data: cardMapping, error: cardMappingError }, { data: profile, error: profileError }, { data: members, error: membersError }, { data: householdRecord, error: householdError }] = await Promise.all([
    household.supabase.from("member_cards").select("user_id, last_four").eq("household_id", household.householdId),
    household.supabase.from("profiles").select("full_name").eq("id", household.userId).maybeSingle(),
    household.supabase.from("household_members").select("user_id, role, color, joined_at").eq("household_id", household.householdId).order("joined_at"),
    household.supabase.from("households").select("name").eq("id", household.householdId).maybeSingle(),
  ]);
  if (cardMappingError || profileError || membersError || householdError) throw new Error("Unable to load account settings.");
  const cardLastFourByUserId = new Map((cardMapping ?? []).map((card) => [card.user_id, card.last_four]));
  const currentCardLastFour = cardLastFourByUserId.get(household.userId) ?? null;
  let partnerState: PartnerAccessState | null = null;
  let partnerDetails: { name: string; color: string; joinedAt: string; cardLastFour?: string } | null = null;

  if (household.role === "owner") {
    const { data: authorization, error: authorizationError } = await household.supabase
      .from("household_allowed_members")
      .select("email")
      .eq("household_id", household.householdId)
      .maybeSingle();

    if (authorizationError) throw new Error("Unable to load partner access.");

    const partner = (members ?? []).find((member) => member.role === "member");
    const hasPartner = Boolean(partner);
    if (hasPartner && !authorization) throw new Error("Joined partner authorization is missing.");

    if (partner && authorization) {
      const { data: partnerProfile, error: partnerProfileError } = await household.supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", partner.user_id)
        .maybeSingle();

      if (partnerProfileError || partnerProfile?.id !== partner.user_id) throw new Error("Unable to load partner settings.");
    partnerDetails = { name: partnerProfile.full_name?.trim() || authorization.email, color: partner.color, joinedAt: partner.joined_at, cardLastFour: cardLastFourByUserId.get(partner.user_id) };
    }

    partnerState = authorization
      ? { status: hasPartner ? "joined" : "pending", email: authorization.email }
      : { status: "empty" };
  }
  return (
    <WorkspaceShell
      title="Settings"
      actions={<><SettingsSaveControl userId={household.userId} /><form action={logOut}><Tooltip><TooltipTrigger asChild><Button type="submit" variant="ghost" size="icon" className="size-14 text-foreground hover:bg-transparent hover:text-foreground" aria-label="Log out"><LogOut aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Log out</TooltipContent></Tooltip></form></>}
    >
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
            <CardTitle>Household</CardTitle>
            <CardDescription>Manage shared members and household access.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70">
              <SettingsRow icon={House} label={householdRecord?.name?.trim() || "Household"} value={household.role === "member" ? householdRecord?.name?.trim() || "Household" : undefined}>
                {household.role === "owner" ? <HouseholdNameSettingsControl name={householdRecord?.name?.trim() || "Household"} /> : null}
              </SettingsRow>
              {household.role === "owner" && partnerState ? (
                <SettingsRow icon={UsersRound} label="Members" description="Manage members.">
                  <MemberManagementSheet
                    owner={{ name: profile?.full_name?.trim() || household.email, email: household.email, color: (members ?? []).find((member) => member.user_id === household.userId)?.color ?? "#dcece3", joinedAt: (members ?? []).find((member) => member.user_id === household.userId)?.joined_at, cardLastFour: currentCardLastFour ?? undefined }}
                    partner={partnerState}
                    member={partnerState.status === "joined" && partnerDetails ? { name: partnerDetails.name, email: partnerState.email, color: partnerDetails.color, joinedAt: partnerDetails.joinedAt, cardLastFour: partnerDetails.cardLastFour } : undefined}
                  />
                </SettingsRow>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your name, user color, and card mapping.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70">
              <SettingsRow icon={UserRound} label="User name">
                <ProfileNameSettingsControl fullName={profile?.full_name?.trim() ?? ""} />
              </SettingsRow>
              <SettingsRow icon={Palette} label="User color">
                <div className="w-[min(22rem,55vw)]">
                  <MemberColorSettingsControl color={(members ?? []).find((member) => member.user_id === household.userId)?.color ?? "#dcece3"} />
                </div>
              </SettingsRow>
              <SettingsRow icon={CreditCard} label="Last 4 digits" description="Used only for future statement imports.">
                <MemberCardSettingsControl lastFour={currentCardLastFour} />
              </SettingsRow>
            </div>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
