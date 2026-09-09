/* =========================================
   GAMES PAGE
========================================= */

const gamesContainer =
    document.getElementById("games-container");


/* =========================================
   SUPABASE
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================
   LOAD GAMES
========================================= */

async function loadGames() {

    try {

        /*
         * Load games.
         */

        const { data: games, error: gamesError } =
            await supabaseClient
                .from("games")
                .select(`
                    id,
                    name,
                    slug,
                    description,
                    created_at,
                    owner_id
                `)
                .order("created_at", {
                    ascending: false
                });


        if (gamesError) {
            throw gamesError;
        }


        if (!Array.isArray(games) || games.length === 0) {

            gamesContainer.innerHTML = `
                <div class="loading">
                    No games available yet.
                </div>
            `;

            return;
        }


        /*
         * Load builds for these games.
         */

        const gameIds = games.map(
            game => game.id
        );


        const { data: builds, error: buildsError } =
            await supabaseClient
                .from("builds")
                .select(`
                    id,
                    game_id,
                    version,
                    build_date
                `)
                .in("game_id", gameIds);


        if (buildsError) {
            throw buildsError;
        }


        /*
         * Get all owner IDs.
         */

        const ownerIds = [
            ...new Set(
                games.map(game => game.owner_id)
            )
        ];


        /*
         * Load profiles.
         */

        const { data: profiles, error: profilesError } =
            await supabaseClient
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name
                `)
                .in("id", ownerIds);


        if (profilesError) {
            throw profilesError;
        }


        /*
         * Render everything.
         */

        renderGames(
            games,
            builds || [],
            profiles || []
        );


    } catch (error) {

        console.error(
            "Could not load games:",
            error
        );

        gamesContainer.innerHTML = `
            <div class="loading">
                Unable to load games.
            </div>
        `;
    }
}


/* =========================================
   RENDER GAMES
========================================= */

function renderGames(
    games,
    builds,
    profiles
) {

    gamesContainer.innerHTML = "";


    games.forEach(game => {

        /*
         * Builds belonging to this game.
         */

        const gameBuilds =
            builds.filter(
                build =>
                    build.game_id === game.id
            );


        /*
         * Sort builds by date.
         */

        const sortedBuilds =
            [...gameBuilds].sort(
                (a, b) =>
                    new Date(b.build_date) -
                    new Date(a.build_date)
            );


        const latestBuild =
            sortedBuilds[0];


        /*
         * Find owner profile.
         */

        const profile =
            profiles.find(
                profile =>
                    profile.id === game.owner_id
            );


        const ownerName =
            profile?.display_name ||
            profile?.username ||
            "Unknown developer";


        /*
         * Create game card.
         */

        const card =
            document.createElement("div");

        card.className = "game-card";


        card.innerHTML = `

            <div class="game-card-content">

                <div class="game-card-top">

                    <div>

                        <div class="game-card-label">
                            GAME
                        </div>

                        <h3 class="game-card-title">
                            ${escapeHTML(game.name)}
                        </h3>

                    </div>

                </div>


                <div class="game-card-owner">

                    BY

                    <strong>
                        ${escapeHTML(ownerName)}
                    </strong>

                </div>


                <p class="game-card-description">

                    ${escapeHTML(
                        game.description ||
                        "No description available."
                    )}

                </p>


                <div class="game-card-info">

                    <div>

                        <span>BUILDS</span>

                        <strong>
                            ${gameBuilds.length}
                        </strong>

                    </div>


                    <div>

                        <span>LATEST</span>

                        <strong>
                            ${
                                latestBuild
                                    ? escapeHTML(
                                        latestBuild.version
                                    )
                                    : "—"
                            }
                        </strong>

                    </div>

                </div>


                <a
                    href="game.html?slug=${escapeAttribute(game.slug)}"
                    class="button button-primary"
                >
                    VIEW GAME
                    <span>→</span>
                </a>

            </div>

        `;


        gamesContainer.appendChild(card);

    });
}


/* =========================================
   SECURITY
========================================= */

function escapeHTML(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "#";
    }

    return String(value)
        .replace(/"/g, "%22")
        .replace(/</g, "%3C")
        .replace(/>/g, "%3E");
}


/* =========================================
   START
========================================= */

loadGames();