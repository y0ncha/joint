import { redirect } from "next/navigation";

import { MemberCardForm } from "@/components/member-card-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentHousehold } from "@/lib/household";

export default async function CardSetupPage() {
  const household = await requireCurrentHousehold();
  const { data: mapping, error } = await household.supabase
    .from("member_card_mappings")
    .select("user_id")
    .eq("household_id", household.householdId)
    .eq("user_id", household.userId)
    .maybeSingle();

  if (error) throw new Error("Unable to load card setup.");
  if (mapping) {
    redirect("/");
    return null;
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md border-white/50 bg-card/90 shadow-[0_24px_70px_rgba(15,44,55,0.2)] backdrop-blur-xl hover:translate-y-0 hover:shadow-[0_24px_70px_rgba(15,44,55,0.2)]">
        <CardHeader className="px-7 pt-10 sm:px-9 sm:pt-12">
          <p className="text-sm font-medium text-primary">Statement imports</p>
          <CardTitle className="text-3xl font-semibold tracking-tight">Add your card</CardTitle>
          <CardDescription className="leading-6">Optionally match imported statement rows to you.</CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-10 sm:px-9 sm:pb-12">
          <MemberCardForm />
        </CardContent>
      </Card>
    </main>
  );
}
