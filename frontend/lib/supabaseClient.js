import safeStorage from './safeStorage.js';
import { createClient } from '@supabase/supabase-js';

// Resolve Supabase project URL supporting Expo, Vite, Next.js, and standard process.env
const rawSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

export const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

// Resolve Supabase Publishable / Anon Key (NEVER use secret or service_role key in client code)
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

// Configuration check: validates URL and key presence without placeholder strings
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('demo-solo-traveler') &&
  !supabaseAnonKey.includes('your-anon-key') &&
  !supabaseAnonKey.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase Configuration Missing] Supabase URL or Publishable Key is not configured. ' +
    'Please verify EXPO_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL and ' +
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  );
} else {
  console.log('[Supabase] Configured successfully for project URL:', supabaseUrl);
}

// Resilient storage wrapper compatible with React Native, Web, and Test environments
export const storageAdapter = {
  getItem: (key) => safeStorage.getItem(key),
  setItem: (key, value) => safeStorage.setItem(key, value),
  removeItem: (key) => safeStorage.removeItem(key),
};

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Creates and returns a single Supabase client configured for Expo / React Native / Web
 * with secure storage session persistence.
 */
export const createClientHelper = (customOptions = {}) => {
  const url = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
  const key = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

  return createClient(url, key, {
    auth: {
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
      ...(customOptions.auth || {}),
    },
    ...customOptions,
  });
};

export const supabase = createClientHelper();
export default supabase;


