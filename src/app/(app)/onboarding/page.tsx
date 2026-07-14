import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { AcceptInvitationForm, CreateHouseholdForm } from "@/components/onboarding-forms";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentHousehold } from "@/lib/household";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await getCurrentHousehold()) redirect("/");

  const { token } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md border-white/50 bg-card/90 shadow-[0_24px_70px_rgba(15,44,55,0.2)] backdrop-blur-xl">
        <CardContent className="p-7 sm:p-9">
          <BrandMark size={48} />
          {token ? (
            <>
              <p className="mt-8 text-sm font-medium text-primary">You&apos;re invited</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join your household.</h1>
              <p className="mt-3 leading-6 text-muted-foreground">Confirm to share one calm view of your household money.</p>
              <AcceptInvitationForm token={token} />
            </>
          ) : (
            <>
              <p className="mt-8 text-sm font-medium text-primary">Set up Joint</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Name your household.</h1>
              <p className="mt-3 leading-6 text-muted-foreground">You&apos;ll be the owner and can invite your partner next.</p>
              <CreateHouseholdForm />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
