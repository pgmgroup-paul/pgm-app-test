import { CheckPalletShell } from "./check-pallet-shell";

export default function WarehouseCheckPalletPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Check pallet configuration</h1>
        <p className="text-muted-foreground text-sm">
          Look up pallet configuration for a SKU so warehouse operators know how to build the pallet.
        </p>
      </div>

      <CheckPalletShell />
    </div>
  );
}
