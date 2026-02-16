import { notFound, redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";

interface EditProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

async function updateProfile(formData: FormData) {
  "use server";

  const admin = await getCurrentUserProfile();
  if (!admin || admin.role !== "admin") {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString();
  const fullName = (formData.get("full_name") || "").toString().trim();
  const company = (formData.get("company") || "").toString().trim();
  const email = (formData.get("email") || "").toString().trim();
  const role = (formData.get("role") || "").toString().trim();
  const staffType = (formData.get("staff_type") || "").toString().trim();
  const customerTier = (formData.get("customer_tier") || "").toString().trim();

  const { error } = await serverSupabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      company: company || null,
      email: email || null,
      role: role || "customer",
      staff_type: staffType || null,
      customer_tier: customerTier || null,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating profile", error);
  }

  redirect("/profiles");
}

export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const admin = await getCurrentUserProfile();
  if (!admin || admin.role !== "admin") {
    redirect("/unauthorized");
  }

  const { id } = await params;

  const { data, error } = await serverSupabase
    .from("profiles")
    .select("id, email, full_name, company, role, staff_type, customer_tier, created_at, is_active")
    .eq("id", id)
    .limit(1)
    .single();

  if (error || !data) {
    console.error("Profile not found", error);
    notFound();
  }

  const profile = data;

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit User</h1>
        <p className="text-sm text-muted-foreground">
          Update basic information for this user. (Role and permissions can be wired in later.)
        </p>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <form action={updateProfile} className="space-y-4">
          <input type="hidden" name="id" value={profile.id} />

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

          <div className="space-y-1 text-sm">
            <label htmlFor="email" className="font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-sm">
            <div className="space-y-1">
              <label htmlFor="role" className="font-medium">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={profile.role}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="supplier">Supplier</option>
                <option value="customer">Customer</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="staff_type" className="font-medium">
                Staff Type
              </label>
              <select
                id="staff_type"
                name="staff_type"
                defaultValue={profile.staff_type ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">(none)</option>
                <option value="manager">Manager</option>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
                <option value="logistics">Logistics</option>
                <option value="warehouse">Warehouse</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="customer_tier" className="font-medium">
                Customer Tier
              </label>
              <select
                id="customer_tier"
                name="customer_tier"
                defaultValue={profile.customer_tier ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">(none)</option>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="distributor">Distributor</option>
                <option value="vip">VIP</option>
                <option value="online">Online</option>
                <option value="promotion">Promotion</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save changes
          </button>
        </form>

        <div className="mt-6 border-t pt-4">
          {profile.is_active === false ? (
            <form
              action={async (formData: FormData) => {
                "use server";

                const admin = await getCurrentUserProfile();
                if (!admin || admin.role !== "admin") {
                  redirect("/unauthorized");
                }

                const id = (formData.get("id") || "").toString();

                const { error } = await serverSupabase
                  .from("profiles")
                  .update({ is_active: true })
                  .eq("id", id);

                if (error) {
                  console.error("Error reactivating user", error);
                }

                redirect("/profiles");
              }}
              className="space-y-3"
            >
              <input type="hidden" name="id" value={profile.id} />
              <div className="space-y-1 text-sm">
                <div className="font-medium text-emerald-700">Reactivate user</div>
                <p className="text-xs text-muted-foreground">
                  This will restore the user to the active list and allow them to sign in again.
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Reactivate User
              </button>
            </form>
          ) : (
            <form
              action={async (formData: FormData) => {
                "use server";

                const admin = await getCurrentUserProfile();
                if (!admin || admin.role !== "admin") {
                  redirect("/unauthorized");
                }

                const id = (formData.get("id") || "").toString();

                const { error } = await serverSupabase
                  .from("profiles")
                  .update({ is_active: false })
                  .eq("id", id);

                if (error) {
                  console.error("Error deactivating user", error);
                }

                redirect("/profiles");
              }}
              className="space-y-3"
            >
              <input type="hidden" name="id" value={profile.id} />
              <div className="space-y-1 text-sm">
                <div className="font-medium text-destructive">Deactivate user</div>
                <p className="text-xs text-muted-foreground">
                  The user will no longer be able to sign in or appear in the active user list, but their
                  data will be kept for records.
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/5"
              >
                Deactivate User
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
