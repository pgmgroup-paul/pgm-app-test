import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/auth/v1/login");
}
