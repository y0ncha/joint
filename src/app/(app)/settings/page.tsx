import { logOut } from "@/app/actions/auth";
import { AccentPicker } from "@/components/accent-picker";
import { InviteForm } from "@/components/invite-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentHousehold } from "@/lib/household";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Bell, CalendarClock, ChevronRight, LogOut, Palette, ShieldCheck, UserPlus, UserRound, UsersRound, type LucideIcon } from "lucide-react";
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

function SettingsSelect({ label, value, options }: { label: string; value: string; options: string[] }) {
  return (
    <Select defaultValue={value}>
      <SelectTrigger aria-label={label} size="sm" className="border-transparent bg-white/55">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default async function SettingsPage() {
  const household = await getCurrentHousehold();
  if (!household) return null;
  const { data: members } = await (await createServerSupabaseClient()).from("household_members").select("user_id, role").eq("household_id", household.householdId).order("joined_at");
  return (
    <WorkspaceShell title="Settings">
      <div className="mt-6 flex w-full flex-col gap-5">
        <Card className="border-white/50 bg-card/90">
          <CardHeader>
            <CardTitle>Household members</CardTitle>
            <CardDescription>People with access to this shared money workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70">
              {(members ?? []).map((member) => (
                <SettingsRow
                  key={member.user_id}
                  icon={member.role === "owner" ? ShieldCheck : UserRound}
                  label={member.role === "owner" ? "Owner" : "Member"}
                  value={member.user_id.slice(0, 8)}
                />
              ))}
              <SettingsRow icon={UsersRound} label="Shared access" value={household.role === "owner" ? "Owner controls" : "Member"} />
            </div>
          </CardContent>
        </Card>

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
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose how household updates should surface in the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70">
              <SettingsRow icon={Bell} label="Monthly summary">
                <SettingsSelect label="Monthly summary" value="On" options={["On", "Off"]} />
              </SettingsRow>
              <SettingsRow icon={CalendarClock} label="Reminder cadence">
                <SettingsSelect label="Reminder cadence" value="Monthly" options={["Weekly", "Monthly", "Off"]} />
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
                  <Button type="submit" variant="outline" size="sm" className="border-transparent bg-white/55">
                    Log out
                  </Button>
                </form>
              </SettingsRow>
              {household.role === "owner" ? (
                <section aria-labelledby="settings-invitations-title" className="flex gap-3 py-4">
                  <UserPlus aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-4">
                      <h3 id="settings-invitations-title" className="text-sm font-medium">Invitations</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Enter their Google email to create one invite link.</p>
                    </div>
                    <InviteForm />
                  </div>
                </section>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
