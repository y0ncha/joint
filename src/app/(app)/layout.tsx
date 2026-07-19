import { redirect } from "next/navigation";

import { getCurrentHouseholdContext } from "@/lib/household";

export default async function AuthenticatedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getCurrentHouseholdContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
    return null;
  }

  if (context.status === "unmatched") {
    redirect("/auth/access-denied");
    return null;
  }

  return children;
}
