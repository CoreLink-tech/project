const SUPABASE_URL = 'https://arrktdplwmugxyxwugcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycmt0ZHBsd211Z3h5eHd1Z2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDgzNjEsImV4cCI6MjA5MTMyNDM2MX0.trHBj4PP2fHeCsMpP2cagWV4zQuj9aXDE0UKrCUI8C4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.SupabaseConfig = {
  client: supabase,
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};