import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasSupabaseConfig,
  supabasePublishableKey,
  supabaseUrl,
} from "./config";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser validates and refreshes the session where needed. Do not move code
  // between this call and the response: refreshed cookies must be returned.
  await supabase.auth.getUser();
  return response;
}
