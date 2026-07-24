import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { LedgerControls, type LedgerFilterKind, type LedgerSort } from "@/components/ledger-controls";
import { StatementImportSheet } from "@/components/statement-import-sheet";
import { TransactionLedger } from "@/components/transaction-ledger";
import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard-data";

function currentMonth() { return new Date().toISOString().slice(0, 7); }

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ filter?: string; import?: string; month?: string; sort?: string }> }) {
  const { filter, import: importRequested, month: requestedMonth, sort } = await searchParams;
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth();
  const filterKind: LedgerFilterKind = filter === "income" || filter === "expense" ? filter : "all";
  const ledgerSort: LedgerSort = sort === "date-asc" || sort === "amount-desc" || sort === "amount-asc" ? sort : "date-desc";
  const data = await getDashboardData(month);
  return (
    <WorkspaceShell
      title="Transactions"
      description="Review this month's household ledger."
      actions={<><StatementImportSheet defaultOpen={importRequested === "1"} /><TransactionSheet categories={data.categories.filter((category) => category.archivedAt === null).map((category) => ({ id: category.id, name: category.name, kind: category.kind }))} currentUserId={data.currentUserId} members={data.members} /></>}
    >
      <LedgerMonthSelector month={month} />
      <Card className="mt-4 border-white/50 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Monthly ledger</CardTitle>
          <LedgerControls filterKind={filterKind} importRequested={importRequested === "1"} month={month} sort={ledgerSort} />
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <TransactionLedger transactions={data.report.recentTransactions} categories={data.categories} filterKind={filterKind} members={data.members} sort={ledgerSort} />
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
