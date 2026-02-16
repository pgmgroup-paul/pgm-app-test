import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";
import { ProfilesTable } from "./profiles-table";

export const metadata: Metadata = {
  title: "Profiles",
};

export const dynamic = "force-dynamic";

async function getProfiles() {
  const { data, error } = await serverSupabase
    .from("profiles")
    .select("id, full_name, company, email, role, staff_type, customer_tier, created_at, is_active")
    .order("email", { ascending: true });

  if (error) {
    console.error("Error fetching profiles", error);
    throw error;
  }

  return data ?? [];
}

export default async function ProfilesPage() {
  const currentProfile = await getCurrentUserProfile();

  if (!currentProfile || currentProfile.role !== "admin") {
    redirect("/unauthorized");
  }

  const profiles = await getProfiles();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">User Profiles</h1>
        <a
          href="/profiles/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add User
        </a>
      </div>
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No profiles found.</p>
      ) : (
        <ProfilesTable profiles={profiles as any} />
      )}
    </div>
  );
}
