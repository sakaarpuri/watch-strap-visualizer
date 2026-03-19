import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export const getSupabaseBrowserClient = () => {
  if (!hasSupabaseConfig) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
};
