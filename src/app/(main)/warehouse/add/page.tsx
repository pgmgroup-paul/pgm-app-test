import { AddShell } from "./add-shell";

export default function WarehouseAddPage() {
  return (
    <>
      {/* Desktop layout */}
      <div className="hidden space-y-4 p-6 md:block">
        <div>
          <h1 className="font-semibold text-lg tracking-tight">Add to inventory</h1>
          <p className="text-muted-foreground text-sm">
            Receive product into a warehouse location from containers, vendors, returns, or found items.
          </p>
        </div>

        <AddShell />
      </div>

      {/* Mobile layout */}
      <div className="block min-h-screen space-y-4 p-4 md:hidden">
        <div>
          <h1 className="font-semibold text-xl tracking-tight">Add to inventory</h1>
          <p className="text-muted-foreground text-sm">
            Receive product into a warehouse location from containers, vendors, returns, or found items.
          </p>
        </div>

        {/* Reuse the same shell for now; internal blocks already stack reasonably and tables are scrollable. */}
        <AddShell />
      </div>
    </>
  );
}
