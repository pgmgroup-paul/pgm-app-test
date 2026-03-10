import { MovementsShell } from "./movements-shell";

export default function WarehouseMovementsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Movement history</h1>
        <p className="text-muted-foreground text-sm">
          See all inventory movements for a single product (adds, deducts, transfers, consolidations, and undos).
        </p>
      </div>

      <MovementsShell />
    </div>
  );
}
