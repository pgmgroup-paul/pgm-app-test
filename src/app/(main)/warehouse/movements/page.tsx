import { MovementsShell } from "./movements-shell";
import { getInitialRecentMovements } from "./load-recent";

export default async function WarehouseMovementsPage() {
  const initialRecentState = await getInitialRecentMovements();
  return (
    <div className="flex min-h-screen flex-col space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Movement history</h1>
        <p className="text-muted-foreground text-sm">
          See all inventory movements for a single product (adds, deducts, transfers, consolidations, and undos).
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <MovementsShell initialRecentState={initialRecentState} />
      </div>
    </div>
  );
}
