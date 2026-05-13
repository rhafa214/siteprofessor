import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "AVISO: Variáveis de ambiente do Supabase não configuradas (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). O upload falhará.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://xyzcompany.supabase.co",
  supabaseKey || "public-anon-key",
);
