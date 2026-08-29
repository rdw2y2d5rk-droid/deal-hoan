export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase now issues publishable keys, while older projects still use anon keys.
// Supporting both makes this integration safe to adopt without rotating a working key.
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);
