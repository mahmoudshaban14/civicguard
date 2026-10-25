import { supabase } from "./supabase";

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("reports")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase connection test failed:", error.message);
      return false;
    }

    console.log("Supabase database query succeeded.");
    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error("Supabase connection test failed:", message);
    return false;
  }
}