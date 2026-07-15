import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { AcceptInvitationForm, CreateHouseholdForm } from "@/components/onboarding-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="w-full max-w-md border-white/50 bg-card/90 shadow-[0_24px_70px_rgba(15,44,55,0.2)] backdrop-blur-xl hover:translate-y-0 hover:shadow-[0_24px_70px_rgba(15,44,55,0.2)]">
        <CardHeader className="items-start px-7 pt-10 sm:px-9 sm:pt-12">
          <div className="flex justify-center">
            <BrandMark size={72} />
          </div>
          {token ? (
            <>
              <p className="mt-8 text-sm font-medium text-primary">You&apos;re invited</p>
              <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">Join your household.</CardTitle>
              <CardDescription className="mt-3 leading-6">Confirm to share one calm view of your household money.</CardDescription>
            </>
          ) : (
            <>
              <p className="mt-8 text-sm font-medium text-primary">Set up Joint</p>
              <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">Name your household.</CardTitle>
              <CardDescription className="mt-3 leading-6">You&apos;ll be the owner and can invite your partner next.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="px-7 pb-10 sm:px-9 sm:pb-12">
          {token ? <AcceptInvitationForm token={token} /> : <CreateHouseholdForm />}
        </CardContent>
      </Card>
    </main>
  );
}
