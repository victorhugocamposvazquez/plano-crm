import { createBrowserClient } from "@supabase/ssr";
export function supabaseConfigured() {
  // Una configuración incompleta debe fallar; nunca cambiar silenciosamente a datos locales.
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
