import { ContainerReceivedShell } from "./container-received-shell";

export default function ContainerReceivedPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Container received</h1>
        <p className="text-muted-foreground text-sm">
          Review what has been received for a container and mark it as received.
        </p>
      </div>

      <ContainerReceivedShell />
    </div>
  );
}
