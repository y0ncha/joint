import { GripVertical, Plus, WandSparkles } from "lucide-react";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type AutomationRulePreview = {
  id: string;
  action: "normalize_merchant" | "assign_category";
  pattern: string;
  replacement?: string;
  destination?: string;
  enabled: boolean;
  position: number;
};

export function AutomationRulesWorkspace({ rules }: { rules: AutomationRulePreview[] }) {
  return (
    <WorkspaceShell
      title="Automations"
      description="Make familiar merchants consistent and categorized."
      actions={
        <Button className="h-11 rounded-full px-4" disabled>
          <Plus data-icon="inline-start" />
          Add rule
        </Button>
      }
    >
      <Card className="mt-6 border-white/50 bg-card/90">
        <CardHeader>
          <CardTitle>Merchant rules</CardTitle>
          <CardDescription>Priority decides which matching rule wins. Preview changes before applying them to existing transactions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rules.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <WandSparkles aria-hidden="true" />
              <p>No automation rules yet.</p>
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-border/70 px-3 py-2">
                <GripVertical aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <span className="w-5 text-sm text-muted-foreground">{rule.position + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{rule.action === "normalize_merchant" ? "Normalize merchant" : "Assign category"}</p>
                  <p className="truncate text-sm text-muted-foreground">{rule.pattern}</p>
                </div>
                <Badge variant="secondary">{rule.replacement ?? rule.destination}</Badge>
                <Badge variant={rule.enabled ? "outline" : "secondary"}>{rule.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
