"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function MemberCardSettingsControl({ lastFour }: { lastFour: string | null }) {
  const [value, setValue] = useState(lastFour ?? "");

  return (
    <Popover>
      <input form="settings-save-form" type="hidden" name="initialLastFour" value={lastFour ?? ""} />
      <input form="settings-save-form" type="hidden" name="lastFour" value={value} />
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Edit last four digits">
          <Pencil aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
        <PopoverHeader>
          <PopoverTitle>Card last four</PopoverTitle>
        </PopoverHeader>
        <InputOTP
          id="card-last-four"
          maxLength={4}
          pattern={REGEXP_ONLY_DIGITS}
          value={value}
          onChange={setValue}
          inputMode="numeric"
          aria-label="Last four digits"
          containerClassName="my-10 justify-center"
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3].map((index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="size-11 rounded-xl border text-lg font-mono first:rounded-xl first:border last:rounded-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <p className="text-sm text-muted-foreground">Only used to match statement imports.</p>
      </PopoverContent>
    </Popover>
  );
}
