"use client";

import { FileUp } from "lucide-react";

import { StatementImportForm } from "@/components/statement-import-form";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function StatementImportSheet({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="h-11 rounded-full px-4 text-primary hover:bg-primary/10 hover:text-primary">
          <FileUp aria-hidden="true" />
          Import
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="inset-x-0 h-dvh w-full max-w-none overflow-y-auto border-white/60 bg-card/95 p-0 shadow-[0_24px_80px_rgba(15,44,55,0.3)] backdrop-blur-xl md:inset-x-auto md:w-3/4 md:max-w-lg">
        <SheetHeader className="p-6">
          <SheetTitle className="text-xl">Import CSV</SheetTitle>
          <SheetDescription>Upload a card statement to the shared ledger.</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6"><StatementImportForm /></div>
      </SheetContent>
    </Sheet>
  );
}
