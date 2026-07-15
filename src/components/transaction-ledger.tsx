import { deleteTransaction } from "@/app/actions/transactions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportCategory, ReportTransaction } from "@/lib/financial-report";

const currency = new Intl.NumberFormat("en-IL", { style: "currency", currency: "ILS" });
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function TransactionLedger({ transactions, categories, members }: { transactions: ReportTransaction[]; categories: ReportCategory[]; members: Array<{ id: string; label: string }> }) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const memberNames = new Map(members.map((member) => [member.id, member.label]));

  if (transactions.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No transactions for this month.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Paid by</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className="font-mono text-muted-foreground">{date.format(new Date(`${transaction.occurredOn}T00:00:00Z`))}</TableCell>
            <TableCell className="capitalize">{transaction.kind}</TableCell>
            <TableCell>{memberNames.get(transaction.paidBy) ?? "Household member"}</TableCell>
            <TableCell>{transaction.categoryId ? categoryNames.get(transaction.categoryId) : "-"}</TableCell>
            <TableCell>{transaction.note || "-"}</TableCell>
            <TableCell className="text-right font-mono">{currency.format(transaction.amount)}</TableCell>
            <TableCell>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Delete ${transaction.note || transaction.kind}`}>Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                    <AlertDialogDescription>This removes the entry from the shared household ledger.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <form action={async () => { "use server"; await deleteTransaction(transaction.id); }}>
                      <AlertDialogAction type="submit" variant="destructive">Delete transaction</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
