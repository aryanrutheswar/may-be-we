import safeStorage from './safeStorage.js';
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://demo-solo-traveler.supabase.co';

const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'demo-anon-key-placeholder';

export const isSupabaseConfigured = Boolean(
  (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
  (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) &&
  !String(rawSupabaseUrl).includes('demo-solo-traveler') &&
  supabaseAnonKey !== 'demo-anon-key-placeholder'
);
console.log('[Supabase] configured:', isSupabaseConfigured);
console.log('[Supabase] URL:', supabaseUrl);

// Resilient storage wrapper compatible with React Native, Web, and Test environments
export const storageAdapter = {
  getItem: (key) => safeStorage.getItem(key),
  setItem: (key, value) => safeStorage.setItem(key, value),
  removeItem: (key) => safeStorage.removeItem(key),
};


const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Creates and returns a Supabase client configured for Expo / React Native
 * with AsyncStorage session persistence.
 */
export const createClientHelper = (customOptions = {}) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
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

