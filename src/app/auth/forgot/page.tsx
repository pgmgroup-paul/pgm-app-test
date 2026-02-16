import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";

async function requestReset(formData: FormData) {
  "use server";

  // If already logged in, you generally don't need forgot password
  const current = await getCurrentUserProfile();
  if (current) {
    redirect("/account");
  }

  const email = (formData.get("email") || "").toString().trim();
  if (!email) {
    console.error("Email is required for password reset");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

  const { error } = await serverSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/reset`,
  });

  if (error) {
    console.error("Error sending reset email", error);
  }

  redirect("/auth/forgot?sent=1");
}

interface ForgotPageProps {
  searchParams?: {
    sent?: string;
  };
}

export default function ForgotPasswordPage({ searchParams }: ForgotPageProps) {
  const sent = searchParams?.sent === "1";

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-md border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
          {sent && (
            <p className="text-sm text-emerald-600">
              If an account exists for that email, a reset link has been sent.
            </p>
          )}
        </div>
        <form action={requestReset} className="space-y-4">
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
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Send reset link
          </button>
        </form>
      </div>
    </div>
  );
}
