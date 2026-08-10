import { LedgerMonthSelector } from "@/components/ledger-month-selector";
import { LedgerControls, type LedgerFilterKind, type LedgerSort } from "@/components/ledger-controls";
import { StatementImportForm } from "@/components/statement-import-form";
import { TransactionLedger } from "@/components/transaction-ledger";
import { TransactionSheet } from "@/components/transaction-sheet";
import { RecurringScheduleList } from "@/components/recurring-schedule-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getLedgerData } from "@/lib/dashboard-read-model";
import { formatDateRange, getValidDateRange, previousMonth } from "@/lib/date-range";

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
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : previousMonth();
  const dateRange = getValidDateRange(from, to);
  const ledgerDescription = dateRange
    ? `Review your household ledger from ${formatDateRange(dateRange)}.`
    : "Review this month's household ledger.";
  const filterKind: LedgerFilterKind = filter === "income" || filter === "expense" ? filter : "all";
  const ledgerSort: LedgerSort = sort === "date-asc" || sort === "amount-desc" || sort === "amount-asc" ? sort : "date-desc";
  const data = await getLedgerData({
    month,
    range: dateRange,
    categoryIds: selectedValues(selectedCategories),
    paidByIds: selectedValues(selectedPaidBy),
    filterKind,
    sort: ledgerSort,
  });
  const { categoryIds, paidByIds } = data;
  return (
    <WorkspaceShell
      title="Transactions"
      description={ledgerDescription}
      actions={
        <>
          <Sheet defaultOpen={importRequested === "1"}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="h-11 rounded-full px-4 text-foreground hover:bg-foreground/10 hover:text-foreground">
                <FileUp aria-hidden="true" />
                Import
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg"
            >
              <SheetHeader className="p-6">
                <SheetTitle className="text-xl">Import CSV</SheetTitle>
                <SheetDescription>Upload a card statement to the shared ledger.</SheetDescription>
              </SheetHeader>
              <div className="px-6 pb-6">
                <StatementImportForm />
              </div>
            </SheetContent>
          </Sheet>
          <TransactionSheet
            directCategories={data.directCategories}
            subcategories={data.subcategories.filter(
              (subcategory) => subcategory.archivedAt === null && subcategory.categoryArchivedAt === null,
            )}
            currentUserId={data.currentUserId}
            defaultMonth={month}
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
            transactions={data.transactions}
            subcategories={data.subcategories}
            directCategories={data.directCategories}
            categoryIds={categoryIds}
            dateRange={dateRange}
            filterKind={filterKind}
            members={data.members}
            paidByIds={paidByIds}
            sort={ledgerSort}
          />
        </CardContent>
      </Card>
      <RecurringScheduleList schedules={data.schedules} />
    </WorkspaceShell>
  );
}
