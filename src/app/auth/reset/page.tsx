"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!password || password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message || "Failed to update password.");
      return;
    }

    setMessage("Password updated. You can now log in with your new password.");
    setTimeout(() => {
      router.push("/auth/v1/login");
    }, 1500);
  };

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-md border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-xl tracking-tight">Set a new password</h1>
          <p className="text-muted-foreground text-sm">Choose a new password for your account.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label htmlFor="password" className="font-medium">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor="confirm" className="font-medium">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {message && <p className="text-emerald-600 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
