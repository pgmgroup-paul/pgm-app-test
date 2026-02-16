import type { ReactNode } from "react";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  // The main (/) layout already provides AppSidebar + SidebarInset shell.
  // Dashboard routes just render their children inside that shell.
  return <>{children}</>;
}
