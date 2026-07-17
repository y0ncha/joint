import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { TransactionLedger } from "@/components/transaction-ledger";
import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard-data";

function currentMonth() { return new Date().toISOString().slice(0, 7); }

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const requestedMonth = (await searchParams).month;
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth();
  const data = await getDashboardData(month);
  return (
    <WorkspaceShell
      title="Transactions"
      description="Review this month's household ledger."
      actions={<TransactionSheet categories={data.categories.filter((category) => category.archivedAt === null).map((category) => ({ id: category.id, name: category.name, kind: category.kind }))} currentUserId={data.currentUserId} members={data.members} />}
    >
      <LedgerMonthSelector month={month} />
      <Card className="mt-4 border-white/50 bg-card/90">
        <CardHeader>
          <CardTitle>Monthly ledger</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <TransactionLedger transactions={data.report.recentTransactions} categories={data.categories} members={data.members} />
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
