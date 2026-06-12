import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service_role key.
 * Bypasea RLS — usar EXCLUSIVAMENTE en Server Actions / Route Handlers.
 * NUNCA exponer al cliente (no usar NEXT_PUBLIC_).
 */
export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Faltan variables de entorno de Supabase Admin (SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
