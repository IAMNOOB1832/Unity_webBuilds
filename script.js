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
         * 1. Aantal geregistreerde ontwikkelaars
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
        const { data: games, error: gamesError } = await supabaseClient
            .from("games")
            .select("id, name, slug, description, owner_id, created_at")
            .order("created_at", { ascending: false });

        if (gamesError) throw gamesError;

        if (!games || games.length === 0) {
            if (gamesGrid) gamesGrid.innerHTML = "<p style='color:#888;'>No games published yet. Be the first to upload one!</p>";
            if (adminGamesGrid) adminGamesGrid.innerHTML = "<p style='color:#888;'>No admin games uploaded yet.</p>";
            if (platformGameCount) platformGameCount.textContent = "0";
            if (footerGameCount) footerGameCount.textContent = "0 GAMES";
            return;
        }

        /*
         * 3. Haal de bijbehorende profielen op
         */
        const ownerIds = [...new Set(games.map(g => g.owner_id).filter(Boolean))];
        let profilesMap = {};

        if (ownerIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabaseClient
                .from("profiles")
                .select("id, username, display_name")
                .in("id", ownerIds);

            if (!profilesError && profiles) {
                profiles.forEach(p => {
                    profilesMap[p.id] = p;
                });
            }
        }

        // Koppel profielen direct aan de games
        const gamesWithProfiles = games.map(game => ({
            ...game,
            authorName: profilesMap[game.owner_id]?.username || profilesMap[game.owner_id]?.display_name || "DEVELOPER"
        }));

        // Tellers bijwerken
        if (platformGameCount) platformGameCount.textContent = gamesWithProfiles.length;
        if (footerGameCount) footerGameCount.textContent = `${gamesWithProfiles.length} ${gamesWithProfiles.length === 1 ? 'GAME' : 'GAMES'}`;

        /*
         * 4. ADMIN GAMES SPOTLIGHT
         */
        if (adminGamesGrid) {
            const myGames = gamesWithProfiles.filter(g => {
                const name = g.authorName.toLowerCase();
                return name.includes("admin") || g.slug === "pancakeria";
            });

            const displayAdminGames = myGames.length > 0 ? myGames : [gamesWithProfiles[0]];

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
         * 5. COMMUNITY GAMES GRID
         */
        if (gamesGrid) {
            const featuredGames = gamesWithProfiles.slice(0, 6);

            gamesGrid.innerHTML = featuredGames.map(game => `
                <div class="latest-card" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div>
                        <span class="section-label">BY ${escapeHTML(game.authorName).toUpperCase()}</span>
                        <h3 style="font-size: 20px; margin-top: 5px; margin-bottom: 10px;">${escapeHTML(game.name)}</h3>
                        <p style="color: #aaa; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                            ${escapeHTML(game.description || "No description provided.")}
                        </p>
                    </div>
                    <a href="game.html?slug=${escapeAttribute(game.slug)}" class="button button-primary" style="text-align: center; justify-content: center;">
                        VIEW GAME <span>→</span>
                    </a>
                </div>
            `).join("");
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