import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/auth/v1/login", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3001"),
  );
  res.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 });
  return res;
}
