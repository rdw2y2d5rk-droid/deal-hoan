import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasSupabaseConfig,
  supabasePublishableKey,
  supabaseUrl,
} from "./config";

let browserClient: SupabaseClient | undefined;

export function createSupabaseBrowserClient() {
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return null;

  browserClient ??= createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
