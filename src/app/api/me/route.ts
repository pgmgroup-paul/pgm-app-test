import { NextResponse } from "next/server";

import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();
    return NextResponse.json({ profile }, { status: 200 });
  } catch (err: any) {
    console.error("Error in /api/me", err);
    return NextResponse.json({ profile: null, error: err?.message ?? "Unexpected error in /api/me" }, { status: 500 });
  }
}
