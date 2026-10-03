import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const url = configuredUrl && !configuredUrl.includes("your-project") ? configuredUrl : undefined;
const key = configuredKey && !configuredKey.includes("your-") ? configuredKey : undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const demoMode = import.meta.env.DEV && (import.meta.env.VITE_REPAIRLEDGER_DEMO_MODE === "true" || !supabase);
