import { AutomationRulesWorkspace } from "@/components/automation-rules-workspace";
import { getMerchantAutomationRulesPage } from "@/lib/merchant-automations";

export default async function AutomationsPage() {
  return <AutomationRulesWorkspace {...await getMerchantAutomationRulesPage()} />;
}
