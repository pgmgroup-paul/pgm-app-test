"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Command, LogOut } from "lucide-react";
import { createPortal } from "react-dom";

import { APP_CONFIG } from "@/config/app-config";
import { getSidebarItemsForProfile, type NavGroup } from "@/navigation/sidebar/sidebar-items";

interface MobileNavDrawerProps {
  // Keep types loose here; we simply forward them conceptually
  variant: any;
  collapsible: any;
}

type SidebarUser = {
  name: string;
  email: string;
  avatar: string;
};

export function MobileNavDrawer({ variant, collapsible }: MobileNavDrawerProps) {
  const router = useRouter();

  const [navOpen, setNavOpen] = useState(false);
  const [sidebarUser, setSidebarUser] = useState<SidebarUser | null>(null);
  const [navItems, setNavItems] = useState<NavGroup[]>([]);
  const [mounted, setMounted] = useState(false);
  const [openParent, setOpenParent] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error during logout", err);
    }
    setNavOpen(false);
    router.push("/auth/v1/login");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;

        const profile = data?.profile ?? null;

        if (profile) {
          const email = profile.email ?? "";
          const name = profile.full_name ?? email;
          setSidebarUser({
            name,
            email,
            avatar: "",
          });
        } else {
          setSidebarUser(null);
        }

        setNavItems(getSidebarItemsForProfile(profile));
      })
      .catch(() => {
        if (!cancelled) {
          setSidebarUser(null);
          setNavItems(getSidebarItemsForProfile(null));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Mobile top header */}
      <div className="flex items-center border-b bg-white p-4 md:hidden">
        <button type="button" onClick={() => setNavOpen(true)} className="text-xl">
          ☰
        </button>
        <h1 className="ml-3 font-semibold">Warehouse</h1>
      </div>

      {/* Mobile drawer */}
      {mounted &&
        navOpen &&
        createPortal(
          <>
            {/* Overlay behind the drawer */}
            <button type="button" className="fixed inset-0 z-40 bg-black/40" onClick={() => setNavOpen(false)} />

            {/* Drawer on the left */}
            <div className="fixed inset-y-0 left-0 z-50 w-64 space-y-4 overflow-y-auto bg-white p-4 shadow-lg">
              {/* Brand */}
              <button type="button" className="mb-2 flex items-center gap-2" onClick={() => setNavOpen(false)}>
                <Command className="h-4 w-4" />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </button>

              {/* Nav groups */}
              <nav className="space-y-4 text-sm">
                {navItems.map((group, groupIndex) => (
                  <div key={`${group.label ?? "group"}-${groupIndex}`} className="space-y-1">
                    {group.label && (
                      <div className="px-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
                        {group.label}
                      </div>
                    )}

                    {group.items.map((item, itemIndex) => (
                      <div key={`${item.title}-${itemIndex}`} className="space-y-1">
                        {item.subItems && item.subItems.length > 0 ? (
                          <>
                            {/* Parent row: tap to toggle submenu */}
                            <button
                              type="button"
                              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left font-medium text-base hover:bg-muted"
                              onClick={() => setOpenParent((prev) => (prev === item.title ? null : item.title))}
                            >
                              <span>{item.title}</span>
                              <span className="text-muted-foreground text-xs">
                                {openParent === item.title ? "−" : "+"}
                              </span>
                            </button>
                            {openParent === item.title &&
                              item.subItems.map((sub, subIndex) => (
                                <Link
                                  key={`${sub.url}-${subIndex}`}
                                  href={sub.url}
                                  prefetch={false}
                                  className="block rounded-md px-4 py-2 text-sm hover:bg-muted"
                                  onClick={() => setNavOpen(false)}
                                >
                                  {sub.title}
                                </Link>
                              ))}
                          </>
                        ) : (
                          <Link
                            href={item.url}
                            prefetch={false}
                            className="block rounded-md px-2 py-2 text-base hover:bg-muted"
                            onClick={() => setNavOpen(false)}
                          >
                            {item.title}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </nav>

              {/* User info + logout */}
              {sidebarUser && (
                <div className="mt-6 space-y-2 border-t pt-3 text-xs">
                  <div>
                    <div className="font-medium">{sidebarUser.name}</div>
                    <div className="text-muted-foreground">{sidebarUser.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
