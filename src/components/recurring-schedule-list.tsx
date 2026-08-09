import { deleteRecurringTransactionSchedule, pauseRecurringTransactionSchedule } from "@/app/actions/recurring-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringScheduleEditForm } from "@/components/recurring-schedule-edit-form";
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
              <form action={pauseRecurringTransactionSchedule.bind(null, schedule.id, !schedule.enabled)}>
                <Button type="submit" variant="outline">
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
              <form action={deleteRecurringTransactionSchedule.bind(null, schedule.id)}>
                <Button type="submit" variant="ghost">
                  Delete
                </Button>
              </form>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
