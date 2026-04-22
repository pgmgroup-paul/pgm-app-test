import { ConsolidationShell } from "./shell";

export default function WarehouseConsolidationPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Consolidation Recommendations</h1>
        <p className="text-muted-foreground text-sm">
          Identify and review inventory locations that are good candidates for consolidation.
        </p>
      </div>

      <ConsolidationShell />
    </div>
  );
}
