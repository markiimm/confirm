import { createClient } from '@supabase/supabase-js';

// Use a service role key apenas em código server-side (rotas /api),
// nunca exponha essa chave no frontend.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
