import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { RouteMembershipFallback } from "./dashboard-loading";
import { CachedProfileInitialAvatar, ProfileInitialAvatar, WorkspaceChrome } from "@/components/workspace-shell";
import { getCurrentHouseholdContext, type CurrentHouseholdContext } from "@/lib/household";

export async function MembershipGate({ children, context }: { children: ReactNode; context: Promise<CurrentHouseholdContext> }) {
  const resolved = await context;

  if (resolved.status === "unauthenticated") {
    redirect("/login");
    return null;
  }

  if (resolved.status === "unmatched") {
    redirect("/auth/access-denied");
    return null;
  }

  return children;
}

export async function MemberProfileSlot({ context }: { context: Promise<CurrentHouseholdContext> }) {
  const resolved = await context;
  return resolved.status === "member" ? <CachedProfileInitialAvatar /> : <ProfileInitialAvatar name="" />;
}

export default function AuthenticatedAppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const context = getCurrentHouseholdContext();

  return (
    <WorkspaceChrome
      profileSlot={
        <Suspense fallback={<ProfileInitialAvatar name="" />}>
          <MemberProfileSlot context={context} />
        </Suspense>
      }
    >
      <Suspense fallback={<RouteMembershipFallback />}>
        <MembershipGate context={context}>{children}</MembershipGate>
      </Suspense>
    </WorkspaceChrome>
  );
}
