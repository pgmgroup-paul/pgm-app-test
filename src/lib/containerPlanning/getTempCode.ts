import { serverSupabase } from "@/lib/serverSupabase";

// Generate a temporary container code via Supabase RPC.
// Uses the `generate_container_temp_code()` function defined in the database.
// Returns a string like "TMP-0001".
export async function getTempContainerCode(): Promise<string> {
  const { data, error } = await serverSupabase.rpc("generate_container_temp_code");

  if (error) {
    console.error("Error calling generate_container_temp_code RPC", error);
    throw new Error("Failed to generate temporary container code");
  }

  // Expecting the RPC to return a scalar text value like "TMP-0001"
  return (data as string) ?? "";
}
