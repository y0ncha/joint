"use client";

import { useState, useTransition } from "react";

import { saveMemberColor } from "@/app/actions/profile";
import { accentPresetColors } from "@/lib/accent";
import { ColorPicker } from "@/components/color-picker";

type Member = { id: string; label: string; color: string };

export function MemberColorSettingsControl({ members }: { members: Member[] }) {
  const [selectedMembers, setSelectedMembers] = useState(members);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function selectColor(userId: string, value: string) {
    if (!value || selectedMembers.find((member) => member.id === userId)?.color === value) return;
    startTransition(async () => {
      const result = await saveMemberColor(userId, value);
      if (result.status === "error") return setMessage(result.formError ?? "Unable to save your color.");
      setSelectedMembers((current) => current.map((member) => member.id === userId ? { ...member, color: value } : member));
      setMessage("Paid by color saved.");
    });
  }

  return (
    <div aria-label="Paid by colors" className="grid w-[min(20rem,55vw)] grid-cols-1 gap-2 sm:grid-cols-2">
      {selectedMembers.map((member) => (
        <div key={member.id} aria-label={`${member.label} paid by color`}>
          <span className="sr-only">{member.label} paid by color</span>
          <ColorPicker color={member.color} onChange={(color) => selectColor(member.id, color)} presetColors={accentPresetColors} recentColors={selectedMembers.map((member) => member.color)} />
        </div>
      ))}
      {isPending || message ? <p aria-live="polite" className="col-span-full text-xs text-muted-foreground">{isPending ? "Saving color…" : message}</p> : null}
    </div>
  );
}
