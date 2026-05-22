import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionCards({
  containersInTransitCount,
  skusIncomingCount,
  skuMissingCartonDimsCount,
  latestOceanFreightAmount,
  latestOceanFreightMeta,
}: {
  containersInTransitCount: number;
  skusIncomingCount: number;
  skuMissingCartonDimsCount: number;
  latestOceanFreightAmount: number;
  latestOceanFreightMeta: { paymentDate: string | null; forwarder: string | null } | null;
}) {
  return (
    <div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Containers In Transit</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {containersInTransitCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Active inbound containers currently on the water</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>SKUs Incoming</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {skusIncomingCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Distinct products currently inbound across active containers
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Latest Ocean Freight</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(latestOceanFreightAmount || 0)}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            {latestOceanFreightMeta?.paymentDate
              ? (() => {
                  const d = new Date(latestOceanFreightMeta.paymentDate!);
                  const dateLabel = Number.isNaN(d.getTime())
                    ? null
                    : d.toLocaleDateString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                      });
                  const forwarder = latestOceanFreightMeta.forwarder;

                  if (dateLabel && forwarder) {
                    return `Latest payment to ${forwarder} on ${dateLabel}`;
                  }

                  if (dateLabel) {
                    return `Latest payment on ${dateLabel}`;
                  }

                  if (forwarder) {
                    return `Latest payment to ${forwarder}`;
                  }

                  return "Latest recorded ocean freight payment";
                })()
              : "Latest recorded ocean freight payment"}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>SKU Missing Carton Dimensions</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {skuMissingCartonDimsCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Inbound SKUs requiring carton dimension setup
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
