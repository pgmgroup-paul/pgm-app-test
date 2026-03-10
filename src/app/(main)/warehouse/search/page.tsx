import { WarehouseSearchShell } from "./search-shell";

export default function WarehouseSearchPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Search</h1>
        <p className="text-muted-foreground text-sm">
          Look up where a SKU is stored or inspect the contents of a location.
        </p>
      </div>

      <WarehouseSearchShell />
    </div>
  );
}
