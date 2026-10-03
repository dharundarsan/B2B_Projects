import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';
import { createChunkedStorage } from './chunkedStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const previewEnabled = __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
export const configured = !!url && !!key && !url.includes('your-project') && !key.startsWith('your-');
export const supabase = configured ? createClient(url, key, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : createChunkedStorage(SecureStore),
    persistSession: Platform.OS !== 'web', autoRefreshToken: true, detectSessionInUrl: false, lock: processLock
  }
}) : null;
