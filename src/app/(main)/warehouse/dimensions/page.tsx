import { DimensionsShell } from "./dimensions-shell";

interface WarehouseDimensionsPageProps {
  searchParams: Promise<{
    sku?: string;
    variant?: string;
  }>;
}

export default async function WarehouseDimensionsPage({ searchParams }: WarehouseDimensionsPageProps) {
  const params = await searchParams;
  const initialSku = params.sku;
  const initialVariant = params.variant;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Case & pallet dimensions</h1>
        <p className="text-muted-foreground text-sm">
          Enter or update case and pallet dimensions for products that are missing them.
        </p>
      </div>

      <DimensionsShell initialSku={initialSku} initialVariant={initialVariant} />
    </div>
  );
}
