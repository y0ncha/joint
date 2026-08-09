"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteRecurringTransactionSchedule, pauseRecurringTransactionSchedule } from "@/app/actions/recurring-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringScheduleEditForm } from "@/components/recurring-schedule-edit-form";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type RecurringScheduleRow = {
  id: string;
  amount: number;
  cadence: string;
  enabled: boolean;
  merchant: string;
  next_occurs_on: string;
  note: string;
  interval_count: number;
};

export function RecurringScheduleList({ schedules }: { schedules: RecurringScheduleRow[] }) {
  const [isPending, startTransition] = useTransition();
  if (!schedules.length) return null;
  return (
    <Card className="mt-4 border-white/50 bg-card/90">
      <CardHeader>
        <CardTitle>Recurring schedules</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div>
              <p className="font-medium">{schedule.merchant || schedule.note || "Recurring transaction"}</p>
              <p className="text-sm text-muted-foreground">
                ₪{schedule.amount} · {schedule.cadence.replace("_", " ")} · next {schedule.next_occurs_on}
              </p>
            </div>
            <div className="flex gap-2">
              <form
                action={() =>
                  startTransition(async () => {
                    const result = await pauseRecurringTransactionSchedule(schedule.id, !schedule.enabled);
                    if (result.status === "error") toast.error(result.formError, { id: `schedule-${schedule.id}` });
                  })
                }
              >
                <Button disabled={isPending} type="submit" variant="outline">
                  {schedule.enabled ? "Pause" : "Resume"}
                </Button>
              </form>
              <Sheet>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline">
                    Edit
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Edit recurring schedule</SheetTitle>
                    <SheetDescription>Changes affect future transactions only.</SheetDescription>
                  </SheetHeader>
                  <div className="p-6">
                    <RecurringScheduleEditForm schedule={schedule} />
                  </div>
                </SheetContent>
              </Sheet>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this recurring schedule?</AlertDialogTitle>
                    <AlertDialogDescription>Future transactions will stop. Existing ledger entries stay unchanged.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <form
                      action={() =>
                        startTransition(async () => {
                          const result = await deleteRecurringTransactionSchedule(schedule.id);
                          if (result.status === "error") toast.error(result.formError, { id: `schedule-${schedule.id}` });
                        })
                      }
                    >
                      <AlertDialogAction disabled={isPending} type="submit" variant="destructive">
                        Delete schedule
                      </AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
