const SUPABASE_URL = "https://rfbsjpghlhcxqesvftta.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmldYMV_7dgG375ZpnT9gA_ncPSwV2I";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

window.supabaseClient =
    supabaseClient;