/* =========================================
   GAME PAGE
========================================= */

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================
   ELEMENTS
========================================= */

const gameStatus =
    document.getElementById("game-status");

const gameName =
    document.getElementById("game-name");

const gameOwner =
    document.getElementById("game-owner");

const gameDescription =
    document.getElementById("game-description");

const latestContainer =
    document.getElementById("latest-build-container");

const historyContainer =
    document.getElementById("build-history");

const footerBuildCount =
    document.getElementById("footer-build-count");


/* =========================================
   GET GAME SLUG
========================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const slug =
    params.get("slug");


/* =========================================
   LOAD GAME
========================================= */

async function loadGame() {

    if (!slug) {

        showError(
            "No game was specified."
        );

        return;
    }


    try {

        /*
         * Load game.
         */

        const { data: game, error: gameError } =
            await supabaseClient
                .from("games")
                .select(`
                    id,
                    name,
                    slug,
                    description,
                    owner_id
                `)
                .eq("slug", slug)
                .single();


        if (gameError) {
            throw gameError;
        }


        /*
         * Load owner profile.
         */

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select(`
                    username,
                    display_name
                `)
                .eq("id", game.owner_id)
                .single();


        if (profileError) {
            throw profileError;
        }


        /*
         * Load builds.
         */

        const { data: builds, error: buildsError } =
            await supabaseClient
                .from("builds")
                .select(`
                    id,
                    version,
                    build_date,
                    status,
                    description,
                    url,
                    build_changelog (
                        change_text
                    )
                `)
                .eq("game_id", game.id)
                .order("build_date", {
                    ascending: false
                });


        if (buildsError) {
            throw buildsError;
        }


        /*
         * Render game information.
         */

        document.title =
            `${game.name} — Build Archive`;


        gameName.textContent =
            game.name;


        const ownerName =
            profile?.display_name ||
            profile?.username ||
            "Unknown developer";


        gameOwner.textContent =
            `BY ${ownerName}`;


        gameDescription.textContent =
            game.description ||
            "No description available.";


        gameStatus.innerHTML = `
            <span class="status-dot"></span>
            GAME IN DEVELOPMENT
        `;


        /*
         * Render builds.
         */

        if (
            !Array.isArray(builds) ||
            builds.length === 0
        ) {

            latestContainer.innerHTML = `
                <div class="loading">
                    No builds available yet.
                </div>
            `;

            historyContainer.innerHTML = `
                <div class="loading">
                    No build history available yet.
                </div>
            `;

            footerBuildCount.textContent =
                "0 BUILDS";

            return;
        }


        renderLatestBuild(builds[0]);

        renderBuildHistory(builds);

        footerBuildCount.textContent =
            `${builds.length} ${
                builds.length === 1
                    ? "BUILD"
                    : "BUILDS"
            }`;


    } catch (error) {

        console.error(
            "Could not load game:",
            error
        );

        showError(
            "Unable to load this game."
        );
    }
}


/* =========================================
   LATEST BUILD
========================================= */

function renderLatestBuild(build) {

    const changelog =
        build.build_changelog || [];


    const changelogHTML =
        changelog.length > 0
            ? `
                <div class="changelog">

                    <div class="changelog-title">
                        WHAT'S NEW
                    </div>

                    <ul>

                        ${changelog
                            .map(
                                item =>
                                    `<li>${escapeHTML(
                                        item.change_text
                                    )}</li>`
                            )
                            .join("")}

                    </ul>

                </div>
            `
            : "";


    latestContainer.innerHTML = `

        <div class="latest-card">

            <div class="build-top">

                <div>

                    <div class="version">
                        ${escapeHTML(
                            build.version
                        )}
                    </div>

                    <div class="build-date">
                        ${escapeHTML(
                            formatDate(
                                build.build_date
                            )
                        )}
                    </div>

                </div>


                <div class="build-status">
                    ${escapeHTML(
                        build.status
                    )}
                </div>

            </div>


            <p class="build-description">
                ${escapeHTML(
                    build.description
                )}
            </p>


            ${changelogHTML}


            <a
                href="${escapeAttribute(
                    build.url
                )}"
                class="button button-primary play-latest"
            >
                PLAY THIS BUILD
                <span>→</span>
            </a>

        </div>
    `;
}


/* =========================================
   BUILD HISTORY
========================================= */

function renderBuildHistory(builds) {

    historyContainer.innerHTML = "";


    builds.forEach(build => {

        const item =
            document.createElement("div");

        item.className =
            "history-item";


        item.innerHTML = `

            <div class="history-version">
                ${escapeHTML(
                    build.version
                )}
            </div>


            <div class="history-date">
                ${escapeHTML(
                    formatDate(
                        build.build_date
                    )
                )}
            </div>


            <div class="history-description">

                ${escapeHTML(
                    build.description
                )}

            </div>


            <div class="history-action">

                <a
                    href="${escapeAttribute(
                        build.url
                    )}"
                    class="play-small"
                >
                    PLAY
                    <span>→</span>
                </a>

            </div>

        `;


        historyContainer.appendChild(item);

    });
}


/* =========================================
   DATE
========================================= */

function formatDate(date) {

    if (!date) {
        return "";
    }


    const parsedDate =
        new Date(date);


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {
        return String(date);
    }


    return parsedDate.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}


/* =========================================
   ERROR
========================================= */

function showError(message) {

    gameStatus.innerHTML = `
        <span class="status-dot"></span>
        ERROR
    `;

    gameName.textContent =
        "Game unavailable";

    gameOwner.textContent =
        "";

    gameDescription.textContent =
        message;


    latestContainer.innerHTML = `
        <div class="loading">
            ${escapeHTML(message)}
        </div>
    `;


    historyContainer.innerHTML = "";
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

loadGame();
