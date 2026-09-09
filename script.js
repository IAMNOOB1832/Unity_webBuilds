/* =========================================
   BUILD WEBSITE
========================================= */

const latestContainer =
    document.getElementById("latest-build-container");

const historyContainer =
    document.getElementById("build-history");

const buildCount =
    document.getElementById("build-count");

const footerBuildCount =
    document.getElementById("footer-build-count");


/* =========================================
   SUPABASE
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================
   LOAD BUILDS
========================================= */

async function loadBuilds() {

    try {

        /*
         * Find Pancakeria.
         */

        const { data: game, error: gameError } =
            await supabaseClient
                .from("games")
                .select("id, name, slug")
                .eq("slug", "pancakeria")
                .single();

        if (gameError) {
            throw gameError;
        }


        /*
         * Load all builds for Pancakeria.
         * Newest build first.
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
                    created_at,
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


        if (!Array.isArray(builds) || builds.length === 0) {

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

            buildCount.textContent = "0";

            footerBuildCount.textContent = "0 BUILDS";

            return;
        }


        /*
         * Convert Supabase data to the format
         * our existing rendering functions expect.
         */

        const formattedBuilds = builds.map(build => ({

            id: build.id,

            version: build.version,

            date: formatDate(build.build_date),

            status: build.status,

            description: build.description,

            url: build.url,

            changelog:
                build.build_changelog?.map(
                    item => item.change_text
                ) || []

        }));


        /*
         * The first build is the latest build.
         */

        const latestBuild = formattedBuilds[0];


        /* Build counter */

        buildCount.textContent =
            formattedBuilds.length;

        footerBuildCount.textContent =
            `${formattedBuilds.length} ${
                formattedBuilds.length === 1
                    ? "BUILD"
                    : "BUILDS"
            }`;


        /* Render latest build */

        renderLatestBuild(latestBuild);


        /* Render history */

        renderBuildHistory(formattedBuilds);


    } catch (error) {

        console.error("Could not load builds:", error);

        latestContainer.innerHTML = `
            <div class="loading">
                Unable to load builds.
            </div>
        `;

        historyContainer.innerHTML = `
            <div class="loading">
                Unable to load build history.
            </div>
        `;
    }
}


/* =========================================
   DATE FORMAT
========================================= */

function formatDate(date) {

    if (!date) {
        return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
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
   LATEST BUILD
========================================= */

function renderLatestBuild(build) {

    const changelog = build.changelog || [];

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
                                    `<li>${escapeHTML(item)}</li>`
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
                        ${escapeHTML(build.version)}
                    </div>

                    <div class="build-date">
                        ${escapeHTML(build.date)}
                    </div>
                </div>

                <div class="build-status">
                    ${escapeHTML(build.status)}
                </div>

            </div>


            <p class="build-description">
                ${escapeHTML(build.description)}
            </p>


            ${changelogHTML}


            <a
                href="${escapeAttribute(build.url)}"
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

        const item = document.createElement("div");

        item.className = "history-item";


        item.innerHTML = `

            <div class="history-version">
                ${escapeHTML(build.version)}
            </div>


            <div class="history-date">
                ${escapeHTML(build.date)}
            </div>


            <div class="history-description">

                ${escapeHTML(build.description)}

            </div>


            <div class="history-action">

                <a
                    href="${escapeAttribute(build.url)}"
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
   SECURITY
========================================= */

function escapeHTML(value) {

    if (value === undefined || value === null) {
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

    if (value === undefined || value === null) {
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

loadBuilds();