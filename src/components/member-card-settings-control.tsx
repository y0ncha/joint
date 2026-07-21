import { MemberCardForm } from "@/components/member-card-form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function MemberCardSettingsControl({ lastFour }: { lastFour: string | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11 border-transparent bg-white/55">
          Edit
        </Button>
      </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
          <PopoverHeader>
            <PopoverTitle>Card last four</PopoverTitle>
          </PopoverHeader>
        <MemberCardForm initialLastFour={lastFour ?? undefined} redirectTo="/settings" showSkip={false} />
      </PopoverContent>
    </Popover>
  );
}
