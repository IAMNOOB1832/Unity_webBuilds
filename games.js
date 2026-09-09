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
         * Load all games.
         * Each game contains its owner profile
         * and its builds.
         */

        const { data: games, error } =
            await supabaseClient
                .from("games")
                .select(`
                    id,
                    name,
                    slug,
                    description,
                    created_at,
                    owner_id,
                    profiles (
                        username,
                        display_name
                    ),
                    builds (
                        id,
                        version,
                        build_date
                    )
                `)
                .order("created_at", {
                    ascending: false
                });


        if (error) {
            throw error;
        }


        if (!Array.isArray(games) || games.length === 0) {

            gamesContainer.innerHTML = `
                <div class="loading">
                    No games available yet.
                </div>
            `;

            return;
        }


        renderGames(games);


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

function renderGames(games) {

    gamesContainer.innerHTML = "";


    games.forEach(game => {

        const builds = game.builds || [];

        /*
         * Find newest build.
         */

        const sortedBuilds = [...builds].sort(
            (a, b) =>
                new Date(b.build_date) -
                new Date(a.build_date)
        );


        const latestBuild =
            sortedBuilds[0];


        /*
         * Owner information.
         */

        const profile = game.profiles;

        const ownerName =
            profile?.display_name ||
            profile?.username ||
            "Unknown developer";


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
                            ${builds.length}
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
