import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";

import { DropshipTransferShell } from "./shell";

export const dynamic = "force-dynamic";

export default async function DropshipTransferPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  // We might later scope by warehouse, but for now this is a global log
  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Transfer overflow to dropship area</h1>
        <p className="text-muted-foreground text-sm">
          Record the units that are transferred from partial cases in containers—or any leftover SO units from partial
          cases—into the dropship area.
        </p>
      </div>

      <DropshipTransferShell />
    </div>
  );
}
