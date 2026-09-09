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
   LOAD BUILDS
========================================= */

async function loadBuilds() {

    try {

        const response = await fetch("builds.json");

        if (!response.ok) {
            throw new Error("Could not load builds.json");
        }

        const builds = await response.json();

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

            return;
        }


        /*
         * We assume the first build in builds.json
         * is always the latest build.
         */

        const latestBuild = builds[0];


        /* Build counter */

        buildCount.textContent = builds.length;

        footerBuildCount.textContent =
            `${builds.length} ${builds.length === 1 ? "BUILD" : "BUILDS"}`;


        /* Render latest build */

        renderLatestBuild(latestBuild);


        /* Render history */

        renderBuildHistory(builds);


    } catch (error) {

        console.error(error);

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
                            .map(item => `<li>${escapeHTML(item)}</li>`)
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


    builds.forEach((build, index) => {

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

/*
 * These functions prevent accidental HTML
 * injection when you add text to builds.json.
 */

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
