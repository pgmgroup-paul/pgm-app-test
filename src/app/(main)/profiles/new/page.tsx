import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";

async function createUser(formData: FormData) {
  "use server";

  const admin = await getCurrentUserProfile();
  if (!admin || admin.role !== "admin") {
    redirect("/unauthorized");
  }

  const fullName = (formData.get("full_name") || "").toString().trim();
  const company = (formData.get("company") || "").toString().trim();
  const email = (formData.get("email") || "").toString().trim();
  const role = (formData.get("role") || "").toString().trim() || "customer";
  const staffType = (formData.get("staff_type") || "").toString().trim();
  const customerTier = (formData.get("customer_tier") || "").toString().trim();
  const password = (formData.get("password") || "").toString();

  if (!email || !password) {
    console.error("Email and password are required to create a user");
    return;
  }

  // 1) Create a Supabase Auth user with a temporary password
  const { data: authData, error: authError } = await serverSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || null,
      company: company || null,
      role,
      staff_type: staffType || null,
      customer_tier: customerTier || null,
    },
  });

  if (authError || !authData?.user) {
    console.error("Error creating auth user", authError);
    return;
  }

  const userId = authData.user.id;

  // 2) Create the matching profiles row keyed by auth.users.id
  const { error: profileError } = await serverSupabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName || null,
      company: company || null,
      role,
      staff_type: staffType || null,
      customer_tier: customerTier || null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("Error creating user profile", profileError);
  }

  redirect("/profiles");
}

export default async function NewUserPage() {
  const admin = await getCurrentUserProfile();
  if (!admin || admin.role !== "admin") {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add User</h1>
        <p className="text-sm text-muted-foreground">Create a new user profile.</p>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <form action={createUser} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label htmlFor="full_name" className="font-medium">
              Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
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
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label htmlFor="password" className="font-medium">
              Temporary Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
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
                defaultValue="customer"
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
                defaultValue=""
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
                defaultValue=""
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
            Save user
          </button>
        </form>
      </div>
    </div>
  );
}
