import { redirect } from "next/navigation";

export default async function StatementImportPage() {
  redirect("/transactions?import=1");
}
