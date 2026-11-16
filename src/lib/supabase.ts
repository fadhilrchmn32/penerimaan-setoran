import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabasePublishableKey =
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    !supabasePublishableKey.includes('YOUR_SUPABASE')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const ENV_STATUS = {
  hasUrl: Boolean(supabaseUrl && !supabaseUrl.includes('YOUR_PROJECT_ID')),
  hasKey: Boolean(supabasePublishableKey && !supabasePublishableKey.includes('YOUR_SUPABASE')),
  supabaseUrlPreview: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, '$1.***') : '(belum diisi)',
};
