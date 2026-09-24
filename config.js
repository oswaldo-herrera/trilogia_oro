// Credenciales públicas de Supabase (Project Settings → API).
// Usa la "anon public key", NUNCA la "service_role".
const SUPABASE_URL = "https://psveoeanrjqncxyhmvfh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xZMKZgaKDubOw4TddwQlpQ_zp8XyQZn";

const sb = SUPABASE_URL && SUPABASE_ANON_KEY
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
