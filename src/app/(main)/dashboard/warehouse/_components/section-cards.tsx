import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionCards({
  openContainersToReceiveCount,
  ordersInQueueCount,
  ordersReadyCount,
  yesterdaysMovementsCount,
}: {
  openContainersToReceiveCount: number;
  ordersInQueueCount: number;
  ordersReadyCount: number;
  yesterdaysMovementsCount: number;
}) {
  return (
    <div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Open Containers to Receive</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {openContainersToReceiveCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Containers physically delivered and pending warehouse receiving
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Orders in Queue for Processing</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {ordersInQueueCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Sales order shipments currently in processing and still requiring picking
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Orders Ready</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {ordersReadyCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Shipments picked, packed, and ready to hand off to carriers</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Yesterday&apos;s Movements</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {yesterdaysMovementsCount.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Inventory movements (putaway, picks, transfers) recorded yesterday
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
