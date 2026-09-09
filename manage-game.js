const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


const gameName =
    document.getElementById("game-name");

const gameDescription =
    document.getElementById("game-description");

const buildsList =
    document.getElementById("builds-list");

const logoutButton =
    document.getElementById("logout-button");

const showAddBuildButton =
    document.getElementById("show-add-build-button");

const addBuildSection =
    document.getElementById("add-build-section");

const cancelAddBuildButton =
    document.getElementById("cancel-add-build-button");

const addBuildForm =
    document.getElementById("add-build-form");

const addChangeButton =
    document.getElementById("add-change-button");

const changelogList =
    document.getElementById("changelog-list");

const formMessage =
    document.getElementById("form-message");


const params =
    new URLSearchParams(window.location.search);

const gameId =
    params.get("id");


let currentUser = null;
let currentGame = null;


/* =========================
   LOAD PAGE
========================= */

async function loadGame() {

    if (!gameId) {

        gameName.textContent =
            "Game not found";

        gameDescription.textContent =
            "No game ID was provided.";

        buildsList.innerHTML =
            "<p>Invalid game.</p>";

        return;
    }


    // Check login

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();


    if (userError || !user) {

        window.location.href =
            "login.html";

        return;
    }


    currentUser = user;


    // Load game

    const {
        data: game,
        error: gameError
    } = await supabaseClient
        .from("games")
        .select(`
            id,
            name,
            slug,
            description,
            owner_id
        `)
        .eq("id", gameId)
        .single();


    if (gameError || !game) {

        console.error(gameError);

        gameName.textContent =
            "Game not found";

        gameDescription.textContent =
            "";

        buildsList.innerHTML =
            "<p>Could not load this game.</p>";

        return;
    }


    // Security check:
    // only the owner can manage the game

    if (game.owner_id !== currentUser.id) {

        gameName.textContent =
            "Access denied";

        gameDescription.textContent =
            "You do not own this game.";

        buildsList.innerHTML =
            "<p>You cannot manage this game.</p>";

        showAddBuildButton.style.display =
            "none";

        return;
    }


    currentGame = game;


    gameName.textContent =
        game.name;

    gameDescription.textContent =
        game.description ||
        "No description.";


    await loadBuilds();


    // Automatically open Add Build
    // when ?action=add-build is present

    if (params.get("action") === "add-build") {

        showAddBuildForm();

    }
}


/* =========================
   LOAD BUILDS
========================= */

async function loadBuilds() {

    const {
        data: builds,
        error: buildsError
    } = await supabaseClient
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
                id,
                change_text,
                created_at
            )
        `)
        .eq("game_id", gameId)
        .order("build_date", {
            ascending: false
        });


    if (buildsError) {

        console.error(buildsError);

        buildsList.innerHTML =
            "<p>Could not load builds.</p>";

        return;
    }


    if (!builds || builds.length === 0) {

        buildsList.innerHTML = `
            <div class="build-card">

                <h2>
                    No builds yet
                </h2>

                <p>
                    This game doesn't have any builds yet.
                </p>

            </div>
        `;

        return;
    }


    renderBuilds(builds);
}


/* =========================
   RENDER BUILDS
========================= */

function renderBuilds(builds) {

    buildsList.innerHTML =
        builds.map(build => {

            const changelog =
                Array.isArray(build.build_changelog)
                    ? build.build_changelog
                    : [];


            const changelogHTML =
                changelog.length > 0
                    ? `
                        <ul>
                            ${changelog.map(change => `
                                <li>
                                    ${escapeHTML(
                                        change.change_text
                                    )}
                                </li>
                            `).join("")}
                        </ul>
                    `
                    : `
                        <p>
                            No changelog entries.
                        </p>
                    `;


            return `
                <article class="build-card">

                    <span class="eyebrow">
                        BUILD
                    </span>

                    <h2>
                        ${escapeHTML(build.version)}
                    </h2>

                    <p>
                        <strong>
                            ${escapeHTML(build.status)}
                        </strong>
                    </p>

                    <p>
                        ${formatDate(build.build_date)}
                    </p>

                    <p>
                        ${escapeHTML(
                            build.description || ""
                        )}
                    </p>


                    <div style="
                        margin-top:20px;
                    ">

                        <span class="eyebrow">
                            WHAT'S NEW
                        </span>

                        ${changelogHTML}

                    </div>


                    <div style="
                        display:flex;
                        gap:10px;
                        flex-wrap:wrap;
                        margin-top:20px;
                    ">

                        <a
                            href="${escapeAttribute(build.url)}"
                            class="btn primary"
                            target="_blank"
                            rel="noopener"
                        >
                            Play build
                        </a>

                        <button
                            type="button"
                            class="btn delete-build-button"
                            data-build-id="${escapeAttribute(build.id)}"
                        >
                            Delete
                        </button>

                    </div>

                </article>
            `;

        }).join("");


    // Delete buttons

    document
        .querySelectorAll(".delete-build-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => deleteBuild(
                    button.dataset.buildId
                )
            );

        });
}


/* =========================
   ADD BUILD FORM
========================= */

function showAddBuildForm() {

    addBuildSection.style.display =
        "block";

    addBuildSection.scrollIntoView({
        behavior: "smooth"
    });
}


function hideAddBuildForm() {

    addBuildSection.style.display =
        "none";

    formMessage.textContent = "";
}


showAddBuildButton.addEventListener(
    "click",
    showAddBuildForm
);


cancelAddBuildButton.addEventListener(
    "click",
    hideAddBuildForm
);


/* =========================
   CHANGELOG
========================= */

addChangeButton.addEventListener(
    "click",
    () => {

        const row =
            document.createElement("div");

        row.className =
            "change-row";

        row.style.marginTop =
            "10px";

        row.innerHTML = `

            <input
                type="text"
                class="change-input"
                placeholder="What changed?"
                required
            >

            <button
                type="button"
                class="btn remove-change-button"
            >
                Remove
            </button>

        `;


        changelogList.appendChild(row);


        row.querySelector(
            ".remove-change-button"
        ).addEventListener(
            "click",
            () => row.remove()
        );
    }
);


/* =========================
   ADD BUILD
========================= */

addBuildForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (!currentGame || !currentUser) {
            return;
        }


        formMessage.textContent =
            "Adding build...";


        const version =
            document
                .getElementById("version")
                .value
                .trim();


        const buildDate =
            document
                .getElementById("build-date")
                .value;


        const status =
            document
                .getElementById("status")
                .value;


        const description =
            document
                .getElementById("description")
                .value
                .trim();


        const buildUrl =
            document
                .getElementById("build-url")
                .value
                .trim();


        const changes =
            [
                ...document.querySelectorAll(
                    ".change-input"
                )
            ]
            .map(input => input.value.trim())
            .filter(Boolean);


        if (!version ||
            !buildDate ||
            !status ||
            !description ||
            !buildUrl
        ) {

            formMessage.textContent =
                "Please fill in all required fields.";

            return;
        }


        // Create build

        const {
            data: build,
            error: buildError
        } = await supabaseClient
            .from("builds")
            .insert({
                game_id: currentGame.id,
                version: version,
                build_date: buildDate,
                status: status,
                description: description,
                url: buildUrl
            })
            .select()
            .single();


        if (buildError) {

            console.error(buildError);

            formMessage.textContent =
                buildError.message ||
                "Could not create build.";

            return;
        }


        // Add changelog entries

        if (changes.length > 0) {

            const changelogRows =
                changes.map(change => ({
                    build_id: build.id,
                    change_text: change
                }));


            const {
                error: changelogError
            } = await supabaseClient
                .from("build_changelog")
                .insert(changelogRows);


            if (changelogError) {

                console.error(
                    changelogError
                );

                formMessage.textContent =
                    "Build created, but changelog could not be saved.";

                await loadBuilds();

                return;
            }
        }


        // Success

        formMessage.textContent =
            "Build successfully added!";


        addBuildForm.reset();


        // Leave one changelog row

        changelogList.innerHTML = `

            <div class="change-row">

                <input
                    type="text"
                    class="change-input"
                    placeholder="What changed?"
                    required
                >

                <button
                    type="button"
                    class="btn remove-change-button"
                >
                    Remove
                </button>

            </div>

        `;


        changelogList
            .querySelector(
                ".remove-change-button"
            )
            .addEventListener(
                "click",
                event => {
                    event.target
                        .closest(".change-row")
                        .remove();
                }
            );


        await loadBuilds();

    }
);


/* =========================
   DELETE BUILD
========================= */

async function deleteBuild(buildId) {

    const confirmed =
        window.confirm(
            "Are you sure you want to delete this build?"
        );


    if (!confirmed) {
        return;
    }


    // Delete changelog first

    const {
        error: changelogError
    } = await supabaseClient
        .from("build_changelog")
        .delete()
        .eq("build_id", buildId);


    if (changelogError) {

        console.error(
            changelogError
        );

        alert(
            "Could not delete the build changelog."
        );

        return;
    }


    // Delete build

    const {
        error: buildError
    } = await supabaseClient
        .from("builds")
        .delete()
        .eq("id", buildId);


    if (buildError) {

        console.error(buildError);

        alert(
            "Could not delete the build."
        );

        return;
    }


    await loadBuilds();
}


/* =========================
   LOG OUT
========================= */

logoutButton.addEventListener(
    "click",
    async () => {

        await supabaseClient.auth.signOut();

        window.location.href =
            "login.html";
    }
);


/* =========================
   HELPERS
========================= */

function formatDate(date) {

    if (!date) {
        return "—";
    }


    return new Date(date)
        .toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );
}


function escapeHTML(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "#";
    }


    return String(value)
        .replaceAll("&", "%26")
        .replaceAll('"', "%22")
        .replaceAll("<", "%3C")
        .replaceAll(">", "%3E")
        .replaceAll(" ", "%20");
}


loadGame();