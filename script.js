/* =========================================
   HOMEPAGE SCRIPT (index.html)
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const gamesGrid = document.getElementById("games-grid");
const adminGamesGrid = document.getElementById("admin-games-grid");
const platformGameCount = document.getElementById("platform-game-count");
const platformUserCount = document.getElementById("platform-user-count");
const footerGameCount = document.getElementById("footer-game-count");

async function loadHomepage() {
    try {
        /*
         * 1. Haal het aantal geregistreerde ontwikkelaars/gebruikers op uit profiles
         */
        const { count: userCount, error: userError } = await supabaseClient
            .from("profiles")
            .select("*", { count: "exact", head: true });

        if (!userError && platformUserCount) {
            platformUserCount.textContent = userCount ?? 0;
        } else if (platformUserCount) {
            platformUserCount.textContent = "—";
        }

        /*
         * 2. Haal alle games op
         */
        let { data: games, error: gamesError } = await supabaseClient
            .from("games")
            .select(`
                id,
                name,
                slug,
                description,
                owner_id,
                created_at,
                profiles (
                    username,
                    display_name
                )
            `)
            .order("created_at", { ascending: false });

        // Fallback als de join met profiles mislukt
        if (gamesError) {
            console.warn("Directe join met profiles mislukt, valt terug op losse games query:", gamesError);
            const fallbackResult = await supabaseClient
                .from("games")
                .select("id, name, slug, description, owner_id, created_at")
                .order("created_at", { ascending: false });

            if (fallbackResult.error) throw fallbackResult.error;
            games = fallbackResult.data;
        }

        if (!games || games.length === 0) {
            if (gamesGrid) gamesGrid.innerHTML = "<p style='color:#888;'>No games published yet. Be the first to upload one!</p>";
            if (adminGamesGrid) adminGamesGrid.innerHTML = "<p style='color:#888;'>No admin games uploaded yet.</p>";
            if (platformGameCount) platformGameCount.textContent = "0";
            if (footerGameCount) footerGameCount.textContent = "0 GAMES";
            return;
        }

        // Game tellers bijwerken
        if (platformGameCount) platformGameCount.textContent = games.length;
        if (footerGameCount) footerGameCount.textContent = `${games.length} ${games.length === 1 ? 'GAME' : 'GAMES'}`;

        /*
         * 3. ADMIN GAMES SPOTLIGHT
         */
        if (adminGamesGrid) {
            const myGames = games.filter(g => {
                const profile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
                const username = (profile?.username || "").toLowerCase();
                return username.includes("admin") || g.slug === "pancakeria";
            });

            const displayAdminGames = myGames.length > 0 ? myGames : [games[0]];

            adminGamesGrid.innerHTML = displayAdminGames.map(game => `
                <div class="latest-card" style="padding: 18px; background: rgba(0,0,0,0.4); border: 1px solid rgba(0, 229, 160, 0.3); display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <span class="section-label" style="color: #00e5a0;">ADMIN PROJECT</span>
                        <h4 style="font-size: 18px; margin: 6px 0 10px 0; color: #fff;">${escapeHTML(game.name)}</h4>
                        <p style="color: #aaa; font-size: 13px; margin-bottom: 15px; line-height: 1.4;">
                            ${escapeHTML(game.description || "No description provided.")}
                        </p>
                    </div>
                    <a href="game.html?slug=${escapeAttribute(game.slug)}" class="button button-primary" style="padding: 8px 12px; font-size: 13px; text-align: center; justify-content: center;">
                        PLAY GAME <span>→</span>
                    </a>
                </div>
            `).join("");
        }

        /*
         * 4. COMMUNITY GAMES GRID
         */
    if (gamesGrid) {
                const featuredGames = games.slice(0, 6);

                gamesGrid.innerHTML = featuredGames.map(game => {
                    const profile = Array.isArray(game.profiles) ? game.profiles[0] : game.profiles;
                    
                    // Pakt eerst de unieke username, anders display_name, anders fallback
                    const authorName = profile?.username || profile?.display_name || "COMMUNITY DEV";

                    return `
                        <div class="latest-card" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                            <div>
                                <span class="section-label">BY ${escapeHTML(authorName).toUpperCase()}</span>
                                <h3 style="font-size: 20px; margin-top: 5px; margin-bottom: 10px;">${escapeHTML(game.name)}</h3>
                                <p style="color: #aaa; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                                    ${escapeHTML(game.description || "No description provided.")}
                                </p>
                            </div>
                            <a href="game.html?slug=${escapeAttribute(game.slug)}" class="button button-primary" style="text-align: center; justify-content: center;">
                                VIEW GAME <span>→</span>
                            </a>
                        </div>
                    `;
                }).join("");
            }

    } catch (error) {
        console.error("Error loading homepage:", error);
        if (gamesGrid) gamesGrid.innerHTML = `<p style='color:#ff4d4d;'>Could not load games: ${escapeHTML(error.message || "Unknown error")}</p>`;
    }
}

function escapeHTML(value) {
    if (value === undefined || value === null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    if (value === undefined || value === null) return "#";
    return String(value)
        .replace(/"/g, "%22")
        .replace(/</g, "%3C")
        .replace(/>/g, "%3E");
}

loadHomepage();