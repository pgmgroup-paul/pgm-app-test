"use client";

import { type ReactNode, useState } from "react";

type ContainerTabKey = "contents" | "events";

interface ContainerTabsProps {
  contents: ReactNode;
  events: ReactNode;
}

export default function ContainerTabs({ contents, events }: ContainerTabsProps) {
  const [activeTab, setActiveTab] = useState<ContainerTabKey>("contents");

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border bg-muted p-0.5 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab("contents")}
          className={
            "rounded-sm px-2 py-1 transition" +
            (activeTab === "contents"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Choose inventory to send
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={
            "rounded-sm px-2 py-1 transition" +
            (activeTab === "events"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Shipment events
        </button>
      </div>

      <div>
        {activeTab === "contents" && contents}
        {activeTab === "events" && events}
      </div>
    </div>
  );
}
