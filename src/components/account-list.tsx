import { archiveAccount, updateAccount } from "@/app/actions/accounts";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Account = { id: string; name: string; kind: "bank" | "credit_card"; opening_balance: number; opening_balance_date: string; archived_at: string | null };

export function AccountList({ accounts }: { accounts: Account[] }) {
  return (
    <Card className="border-white/50 bg-card/90">
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>Shared bank accounts and cards used for household entries.</CardDescription>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {accounts.map((account) => (
              <li key={account.id} className="rounded-lg border border-border bg-background/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{account.archived_at ? "Archived" : account.kind === "bank" ? "Bank" : "Credit card"}</p>
                  </div>
                </div>
                {!account.archived_at ? (
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm underline underline-offset-4">Edit account</summary>
                    <div className="flex flex-col gap-4 pt-2">
                      <form action={async (formData) => { "use server"; await updateAccount(account.id, formData); }}>
                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor={`account-name-${account.id}`}>Account name</FieldLabel>
                            <Input id={`account-name-${account.id}`} name="name" defaultValue={account.name} required />
                          </Field>
                          <Field>
                            <FieldLabel>Account type</FieldLabel>
                            <Select name="kind" defaultValue={account.kind} required>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose account type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="bank">Bank</SelectItem>
                                  <SelectItem value="credit_card">Credit card</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`opening-balance-${account.id}`}>Opening balance</FieldLabel>
                            <Input id={`opening-balance-${account.id}`} name="openingBalance" defaultValue={account.opening_balance} inputMode="decimal" required />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={`opening-date-${account.id}`}>Opening balance date</FieldLabel>
                            <Input id={`opening-date-${account.id}`} name="openingBalanceDate" type="date" defaultValue={account.opening_balance_date} required />
                          </Field>
                          <Button type="submit" variant="outline">Save account</Button>
                        </FieldGroup>
                      </form>
                      <Separator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="destructive">Archive account</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive this account?</AlertDialogTitle>
                            <AlertDialogDescription>Archived accounts stay out of new entries. Accounts with transaction history remain available.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <form action={async () => { "use server"; await archiveAccount(account.id); }}>
                              <AlertDialogAction type="submit" variant="destructive">Archive account</AlertDialogAction>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
