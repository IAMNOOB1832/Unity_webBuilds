const SUPABASE_URL = "https://rfbsjpghlhcxqesvftta.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmldYMV_7dgG375ZpnT9gA_ncPSwV2I";

if (!window.supabase) {

    console.error(
        "Supabase library could not be loaded."
    );

} else if (
    !window.SUPABASE_URL ||
    !window.SUPABASE_KEY
) {

    console.error(
        "Supabase URL or key is missing."
    );

} else {

    window.supabaseClient =
        window.supabase.createClient(
            window.SUPABASE_URL,
            window.SUPABASE_KEY
        );

    console.log(
        "Supabase client initialized."
    );
}