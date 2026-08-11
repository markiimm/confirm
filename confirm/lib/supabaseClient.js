import { createClient } from '@supabase/supabase-js';

// Chave pública (anon) — segura para expor no frontend.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
