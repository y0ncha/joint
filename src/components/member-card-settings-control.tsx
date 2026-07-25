"use client";

import { useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function MemberCardSettingsControl({ lastFour }: { lastFour: string | null }) {
  const [value, setValue] = useState(lastFour ?? "");

  return (
    <>
      <input form="settings-save-form" type="hidden" name="initialLastFour" value={lastFour ?? ""} />
      <InputOTP
        form="settings-save-form"
        id="card-last-four"
        name="lastFour"
        maxLength={4}
        pattern={REGEXP_ONLY_DIGITS}
        value={value}
        onChange={setValue}
        inputMode="numeric"
        aria-label="Last four digits"
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
    </>
  );
}
