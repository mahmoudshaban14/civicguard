
import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { error } = await supabase.auth.getSession();

  if (error) {
    console.error("Supabase connection test failed:", error.message);
    return false;
  }

  console.log("Supabase client initialized successfully.");
  return true;
}
