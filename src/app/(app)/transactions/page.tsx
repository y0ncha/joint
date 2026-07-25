import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { LedgerControls, type LedgerFilterKind, type LedgerSort } from "@/components/ledger-controls";
import { StatementImportSheet } from "@/components/statement-import-sheet";
import { TransactionLedger } from "@/components/transaction-ledger";
import { TransactionSheet } from "@/components/transaction-sheet";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard-data";
import { currentMonth, formatDateRange, getValidDateRange } from "@/lib/date-range";

function selectedValues(value: string | undefined) {
  return value?.split(",").filter(Boolean) ?? [];
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    categories?: string;
    filter?: string;
    from?: string;
    import?: string;
    month?: string;
    paidBy?: string;
    sort?: string;
    to?: string;
  }>;
}) {
  const {
    categories: selectedCategories,
    filter,
    from,
    import: importRequested,
    month: requestedMonth,
    paidBy: selectedPaidBy,
    sort,
    to,
  } = await searchParams;
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth();
  const dateRange = getValidDateRange(from, to);
  const ledgerDescription = dateRange
    ? `Review your household ledger from ${formatDateRange(dateRange)}.`
    : "Review this month's household ledger.";
  const filterKind: LedgerFilterKind = filter === "income" || filter === "expense" ? filter : "all";
  const ledgerSort: LedgerSort = sort === "date-asc" || sort === "amount-desc" || sort === "amount-asc" ? sort : "date-desc";
  const data = await getDashboardData(month);
  const selectedCategoryIds = selectedValues(selectedCategories).filter(
    (id) => id === "uncategorized" || data.categories.some((category) => category.id === id),
  );
  const categoryIds = selectedCategoryIds.length
    ? selectedCategoryIds
    : [...data.categories.map((category) => category.id), "uncategorized"];
  const paidByIds = selectedValues(selectedPaidBy).filter((id) => id === "unassigned" || data.members.some((member) => member.id === id));
  return (
    <WorkspaceShell
      title="Transactions"
      description={ledgerDescription}
      actions={
        <>
          <StatementImportSheet defaultOpen={importRequested === "1"} />
          <TransactionSheet
            categories={data.categories
              .filter((category) => category.archivedAt === null)
              .map((category) => ({ id: category.id, name: category.name, kind: category.kind }))}
            currentUserId={data.currentUserId}
            members={data.members}
          />
        </>
      }
    >
      <LedgerMonthSelector month={month} range={dateRange} />
      <Card className="mt-4 border-white/50 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{dateRange ? "Date range ledger" : "Monthly ledger"}</CardTitle>
          <LedgerControls
            categories={data.categories}
            categoryIds={categoryIds}
            filterKind={filterKind}
            importRequested={importRequested === "1"}
            members={data.members}
            month={month}
            paidByIds={paidByIds}
            sort={ledgerSort}
          />
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <TransactionLedger
            key={[month, dateRange?.from, dateRange?.to, filterKind, categoryIds.join(","), paidByIds.join(",")].join(":")}
            transactions={dateRange ? data.transactions : data.report.recentTransactions}
            categories={data.categories}
            categoryIds={categoryIds}
            dateRange={dateRange}
            filterKind={filterKind}
            members={data.members}
            paidByIds={paidByIds}
            sort={ledgerSort}
          />
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
