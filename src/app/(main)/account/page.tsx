import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";

async function updateAccount(formData: FormData) {
  "use server";

  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/auth/v1/login");
  }

  const fullName = (formData.get("full_name") || "").toString().trim();
  const company = (formData.get("company") || "").toString().trim();

  const { error } = await serverSupabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      company: company || null,
    })
    .eq("id", profile.id);

  if (error) {
    console.error("Error updating profile", error);
  }

  redirect("/account");
}

export default async function AccountPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">View and update your account details.</p>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div className="space-y-1 text-sm">
          <div className="font-medium">Email</div>
          <div className="font-mono text-xs">{profile.email}</div>
        </div>

        <form action={updateAccount} className="space-y-4 pt-2 border-t mt-4">
          <div className="space-y-1 text-sm">
            <label htmlFor="full_name" className="font-medium">
              Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={profile.full_name ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label htmlFor="company" className="font-medium">
              Company
            </label>
            <input
              id="company"
              name="company"
              type="text"
              defaultValue={profile.company ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save changes
          </button>
        </form>
      </div>
    </div>
  );
}
