import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseConfig, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

export const getSupabaseServerClient = async () => {
  if (!hasSupabaseConfig) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
};
