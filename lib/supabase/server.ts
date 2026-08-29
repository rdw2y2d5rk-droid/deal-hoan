import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  hasSupabaseConfig,
  supabasePublishableKey,
  supabaseUrl,
} from "./config";

export async function createSupabaseServerClient() {
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return null;

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The callback route and proxy
          // handle session refreshes where setting cookies is permitted.
        }
      },
    },
  });
}
