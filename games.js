/* =========================================
   GAMES PAGE
========================================= */

const gamesContainer =
    document.getElementById("games-container");

const userFilter =
    document.getElementById("user-filter");


/* =========================================
   SUPABASE
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================
   PAGE DATA
========================================= */

let allGames = [];
let allBuilds = [];
let allProfiles = [];


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
                `);

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
                    display_name,
                    is_admin
                `)
                .in("id", ownerIds);


        if (profilesError) {
            throw profilesError;
        }


        /*
         * Store data globally.
         */

        allGames = games;
        allBuilds = builds || [];
        allProfiles = profiles || [];


        /*
         * Build user filter.
         */

        populateUserFilter(
            allProfiles
        );


        /*
         * Sort and render.
         */

        renderGames(
            allGames,
            allBuilds,
            allProfiles
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
   USER FILTER
========================================= */

function populateUserFilter(
    profiles
) {

    /*
     * Remove old options except "All users".
     */

    userFilter.innerHTML = `
        <option value="all">
            All users
        </option>
    `;


    /*
     * Sort users:
     *
     * 1. Admin first
     * 2. Then display name / username alphabetically
     */

    const sortedProfiles =
        [...profiles].sort((a, b) => {

            const adminA =
                a.is_admin === true;

            const adminB =
                b.is_admin === true;


            if (adminA && !adminB) {
                return -1;
            }

            if (!adminA && adminB) {
                return 1;
            }


            const nameA =
                (
                    a.display_name ||
                    a.username ||
                    ""
                ).toLowerCase();

            const nameB =
                (
                    b.display_name ||
                    b.username ||
                    ""
                ).toLowerCase();


            return nameA.localeCompare(
                nameB
            );
        });


    /*
     * Create options.
     */

    sortedProfiles.forEach(profile => {

        const option =
            document.createElement("option");

        option.value =
            profile.id;


        const displayName =
            profile.display_name ||
            profile.username ||
            "Unknown developer";


        if (profile.is_admin === true) {

            option.textContent =
                `Administrator — ${displayName}`;

        } else {

            option.textContent =
                displayName;
        }


        userFilter.appendChild(
            option
        );
    });


    /*
     * Filter games when selection changes.
     */

    userFilter.addEventListener(
        "change",
        handleUserFilter
    );
}


/* =========================================
   HANDLE FILTER
========================================= */

function handleUserFilter() {

    const selectedUser =
        userFilter.value;


    if (selectedUser === "all") {

        renderGames(
            allGames,
            allBuilds,
            allProfiles
        );

        return;
    }


    const filteredGames =
        allGames.filter(
            game =>
                game.owner_id ===
                selectedUser
        );


    if (filteredGames.length === 0) {

        gamesContainer.innerHTML = `
            <div class="loading">
                This user has no games yet.
            </div>
        `;

        return;
    }


    renderGames(
        filteredGames,
        allBuilds,
        allProfiles
    );
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


    /*
     * Sort games:
     *
     * 1. Admin games first
     * 2. Then users alphabetically
     * 3. Then newest games
     */

    const sortedGames =
        [...games].sort((a, b) => {

            const profileA =
                profiles.find(
                    profile =>
                        profile.id ===
                        a.owner_id
                );

            const profileB =
                profiles.find(
                    profile =>
                        profile.id ===
                        b.owner_id
                );


            const adminA =
                profileA?.is_admin === true;

            const adminB =
                profileB?.is_admin === true;


            /*
             * Admin always comes first.
             */

            if (adminA && !adminB) {
                return -1;
            }

            if (!adminA && adminB) {
                return 1;
            }


            /*
             * Sort by owner name.
             */

            const ownerA =
                (
                    profileA?.display_name ||
                    profileA?.username ||
                    ""
                ).toLowerCase();

            const ownerB =
                (
                    profileB?.display_name ||
                    profileB?.username ||
                    ""
                ).toLowerCase();


            const ownerCompare =
                ownerA.localeCompare(
                    ownerB
                );


            if (ownerCompare !== 0) {
                return ownerCompare;
            }


            /*
             * Same owner:
             * newest game first.
             */

            return (
                new Date(b.created_at) -
                new Date(a.created_at)
            );
        });


    /*
     * Render cards.
     */

    sortedGames.forEach(game => {

        /*
         * Builds belonging to this game.
         */

        const gameBuilds =
            builds.filter(
                build =>
                    build.game_id ===
                    game.id
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
                    profile.id ===
                    game.owner_id
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

        card.className =
            "game-card";


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


        gamesContainer.appendChild(
            card
        );
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