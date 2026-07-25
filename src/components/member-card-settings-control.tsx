import { PenLine } from "lucide-react";

import { MemberCardForm } from "@/components/member-card-form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MemberCardSettingsControl({ lastFour }: { lastFour: string | null }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-11 text-foreground hover:bg-transparent hover:text-foreground" aria-label="Edit last four digits">
              <PenLine aria-hidden="true" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Edit last four digits</TooltipContent>
      </Tooltip>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
          <PopoverHeader>
            <PopoverTitle>Card last four</PopoverTitle>
          </PopoverHeader>
        <MemberCardForm initialLastFour={lastFour ?? undefined} redirectTo="/settings" showSkip={false} />
      </PopoverContent>
    </Popover>
  );
}
