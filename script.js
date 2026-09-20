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
const footerGameCount = document.getElementById("footer-game-count");

async function loadHomepage() {
    try {
        // Haal alle games op inclusief de eigenaar profielen
        const { data: games, error } = await supabaseClient
            .from("games")
            .select(`
                id,
                name,
                slug,
                description,
                created_at,
                profiles (
                    username,
                    display_name
                )
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!games || games.length === 0) {
            if (gamesGrid) gamesGrid.innerHTML = "<p style='color:#888;'>No games published yet. Be the first to upload one!</p>";
            if (adminGamesGrid) adminGamesGrid.innerHTML = "<p style='color:#888;'>No admin games uploaded yet.</p>";
            if (platformGameCount) platformGameCount.textContent = "0";
            if (footerGameCount) footerGameCount.textContent = "0 GAMES";
            return;
        }

        // Tellers bijwerken
        if (platformGameCount) platformGameCount.textContent = games.length;
        if (footerGameCount) footerGameCount.textContent = `${games.length} ${games.length === 1 ? 'GAME' : 'GAMES'}`;

        /* =========================================
           1. ADMIN / LUCAS GAMES SPOTLIGHT
        ========================================= */
        if (adminGamesGrid) {
            // Zoekt op profielen waar de naam 'lucas' of 'admin' in voorkomt
            const myGames = games.filter(g => {
                const username = (g.profiles?.username || g.profiles?.display_name || "").toLowerCase();
                return username.includes("lucas") || username.includes("admin");
            });

            if (myGames.length > 0) {
                adminGamesGrid.innerHTML = myGames.map(game => `
                    <div class="latest-card" style="padding: 18px; background: rgba(0,0,0,0.4); border: 1px solid rgba(0, 229, 160, 0.3); display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <span class="section-label" style="color: #00e5a0;">ADMIN PROJECT</span>
                            <h4 style="font-size: 18px; margin: 6px 0 10px 0; color: #fff;">${escapeHTML(game.name)}</h4>
                            <p style="color: #aaa; font-size: 13px; margin-bottom: 15px; line-height: 1.4;">
                                ${escapeHTML(game.description || "No description provided.")}
                            </p>
                        </div>
                        <a href="game.html?slug=${escapeAttribute(game.slug)}" class="button button-primary" style="padding: 8px 12px; font-size: 13px; text-align: center; justify-content: center;">
                            PLAY MY GAME <span>→</span>
                        </a>
                    </div>
                `).join("");
            } else {
                // Fallback: Als er nog geen match is, toont hij gewoon de allereerste game
                const firstGame = games[0];
                adminGamesGrid.innerHTML = `
                    <div class="latest-card" style="padding: 18px; background: rgba(0,0,0,0.4); border: 1px solid rgba(0, 229, 160, 0.3); display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <span class="section-label" style="color: #00e5a0;">ADMIN PROJECT</span>
                            <h4 style="font-size: 18px; margin: 6px 0 10px 0; color: #fff;">${escapeHTML(firstGame.name)}</h4>
                            <p style="color: #aaa; font-size: 13px; margin-bottom: 15px; line-height: 1.4;">
                                ${escapeHTML(firstGame.description || "No description provided.")}
                            </p>
                        </div>
                        <a href="game.html?slug=${escapeAttribute(firstGame.slug)}" class="button button-primary" style="padding: 8px 12px; font-size: 13px; text-align: center; justify-content: center;">
                            PLAY GAME <span>→</span>
                        </a>
                    </div>
                `;
            }
        }

        /* =========================================
           2. COMMUNITY GAMES GRID
        ========================================= */
        if (gamesGrid) {
            const featuredGames = games.slice(0, 6);

            gamesGrid.innerHTML = featuredGames.map(game => {
                const authorName = game.profiles?.display_name || game.profiles?.username || "Unknown Developer";

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
        if (gamesGrid) gamesGrid.innerHTML = "<p style='color:#ff4d4d;'>Could not load featured games.</p>";
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