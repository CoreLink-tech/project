const SUPABASE_URL = 'https://mxyhhfmiemvzmrrpwehd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eWhoZm1pZW12em1ycnB3ZWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDA0NTYsImV4cCI6MjA5MTQxNjQ1Nn0.i0wT7uAMYokY8Dl0EJmucKN_rbHpGb5NVKtJOJJky_4';

const supabaseFactory = window.supabase?.createClient || window.supabase?.default?.createClient;
const supabaseClient = typeof supabaseFactory === 'function'
  ? supabaseFactory(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

window.SupabaseConfig = {
  client: supabaseClient,
  supabase: supabaseClient,
  requireEmailConfirmation: false,
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};

window.supabaseClient = supabaseClient;
