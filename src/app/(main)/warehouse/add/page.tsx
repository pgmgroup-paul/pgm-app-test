import { AddShell } from "./add-shell";

export default function WarehouseAddPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Add to inventory</h1>
        <p className="text-muted-foreground text-sm">
          Receive product into a warehouse location from containers, vendors, returns, or found items.
        </p>
      </div>

      <AddShell />
    </div>
  );
}
