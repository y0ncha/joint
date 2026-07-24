"use client";

import { useState, useTransition } from "react";

import { saveMemberColor } from "@/app/actions/profile";
import { ColorPicker } from "@/components/color-picker";

type Member = { id: string; label: string; color: string };

export function MemberColorSettingsControl({ members }: { members: Member[] }) {
  const [selectedMembers, setSelectedMembers] = useState(members);
  const [, startTransition] = useTransition();

  function selectColor(userId: string, value: string) {
    if (!value || selectedMembers.find((member) => member.id === userId)?.color === value) return;
    startTransition(async () => {
      const result = await saveMemberColor(userId, value);
      if (result.status === "error") return;
      setSelectedMembers((current) => current.map((member) => member.id === userId ? { ...member, color: value } : member));
    });
  }

  return (
    <div aria-label="Paid by colors" className="flex flex-col gap-2">
      {selectedMembers.map((member) => (
        <div key={member.id} aria-label={`${member.label} paid by color`}>
          <span className="sr-only">{member.label} paid by color</span>
          <ColorPicker color={member.color} onChange={(color) => selectColor(member.id, color)} recentColors={selectedMembers.map((member) => member.color)} />
        </div>
      ))}
    </div>
  );
}
