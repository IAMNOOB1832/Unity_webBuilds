const SUPABASE_URL = "https://rfbsjpghlhcxqesvftta.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmldYMV_7dgG375ZpnT9gA_ncPSwV2I";

window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_KEY
);