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

const unityBuildInput =
    document.getElementById("unity-build");

const selectedFilesText =
    document.getElementById("selected-files");

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
   UNITY FILE SELECTION
========================= */

unityBuildInput.addEventListener(
    "change",
    () => {

        const files =
            Array.from(
                unityBuildInput.files || []
            );


        if (files.length === 0) {

            selectedFilesText.textContent =
                "No files selected.";

            return;
        }


        const hasIndex =
            files.some(file => {

                const relativePath =
                    file.webkitRelativePath ||
                    file.name;

                return relativePath
                    .split("/")
                    .pop()
                    .toLowerCase() === "index.html";
            });


        const totalSize =
            files.reduce(
                (total, file) =>
                    total + file.size,
                0
            );


        selectedFilesText.textContent =
            `${files.length} file(s) selected.` +
            (
                hasIndex
                    ? " Unity index.html found."
                    : " WARNING: index.html was not found."
            ) +
            ` Total size: ${formatBytes(totalSize)}.`;
    }
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


        try {

            formMessage.textContent =
                "Preparing build...";


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


            const changes =
                [
                    ...document.querySelectorAll(
                        ".change-input"
                    )
                ]
                .map(input => input.value.trim())
                .filter(Boolean);


            const files =
                Array.from(
                    unityBuildInput.files || []
                );


            /* =========================
               VALIDATION
            ========================= */

            if (
                !version ||
                !buildDate ||
                !status ||
                !description
            ) {

                formMessage.textContent =
                    "Please fill in all required fields.";

                return;
            }


            if (!/^v\d+(?:\.\d+)*$/i.test(version)) {

                formMessage.textContent =
                    "Version must look like v0.2.";

                return;
            }


            if (files.length === 0) {

                formMessage.textContent =
                    "Please select your Unity WebGL build folder.";

                return;
            }


            const indexFile =
                files.find(file => {

                    const relativePath =
                        file.webkitRelativePath ||
                        file.name;

                    return relativePath
                        .split("/")
                        .pop()
                        .toLowerCase() === "index.html";
                });


            if (!indexFile) {

                formMessage.textContent =
                    "The selected folder does not contain index.html.";

                return;
            }


            /*
             * IMPORTANT:
             *
             * We upload ONE file at a time.
             *
             * We do NOT create one huge
             * encodedFiles array anymore.
             */


            const uploadedFiles = [];


            /* =========================
               UPLOAD FILES ONE BY ONE
            ========================= */

            for (
                let i = 0;
                i < files.length;
                i++
            ) {

                const file =
                    files[i];


                let relativePath =
                    file.webkitRelativePath ||
                    file.name;


                /*
                 * Example:
                 *
                 * MyBuild/index.html
                 *
                 * becomes:
                 *
                 * index.html
                 */


                const pathParts =
                    relativePath
                        .split("/")
                        .filter(Boolean);


                if (pathParts.length > 1) {

                    pathParts.shift();

                }


                relativePath =
                    pathParts.join("/");


                if (!relativePath) {

                    throw new Error(
                        "Invalid file path."
                    );
                }


                /*
                 * Keep individual files
                 * below the safe Edge Function
                 * memory range.
                 *
                 * GitHub allows up to 100 MB,
                 * but Edge Functions have
                 * much less memory available.
                 */

                const MAX_FILE_SIZE =
                    60 * 1024 * 1024;


                if (file.size > MAX_FILE_SIZE) {

                    throw new Error(
                        `${file.name} is too large (${formatBytes(file.size)}). ` +
                        `For now, individual files must be smaller than 60 MB.`
                    );
                }


                formMessage.textContent =
                    `Uploading file ${i + 1}/${files.length}: ${relativePath}`;


                /*
                 * Read ONLY this file.
                 */

                const arrayBuffer =
                    await file.arrayBuffer();


                const base64 =
                    arrayBufferToBase64(
                        arrayBuffer
                    );


                /*
                 * Send ONLY this file
                 * to the Edge Function.
                 */

                const {
                    data: uploadData,
                    error: uploadError
                } = await supabaseClient.functions.invoke(
                    "github-upload-file",
                    {
                        body: {
                            gameSlug:
                                currentGame.slug,

                            version:
                                version,

                            filePath:
                                relativePath,

                            contentBase64:
                                base64
                        }
                    }
                );


                /*
                 * Release references as soon
                 * as possible.
                 */

                if (uploadError) {

                    console.error(
                        "File upload error:",
                        uploadError
                    );

                    throw new Error(
                        uploadError.message ||
                        `Could not upload ${relativePath}.`
                    );
                }


                if (
                    !uploadData ||
                    !uploadData.success ||
                    !uploadData.sha
                ) {

                    throw new Error(
                        uploadData?.error ||
                        `GitHub could not upload ${relativePath}.`
                    );
                }


                uploadedFiles.push({
                    path:
                        relativePath,

                    sha:
                        uploadData.sha
                });


                /*
                 * Let the browser release
                 * temporary memory before
                 * moving to the next file.
                 */

                await new Promise(
                    resolve =>
                        setTimeout(resolve, 0)
                );
            }


            /* =========================
               CREATE GITHUB COMMIT
            ========================= */

            formMessage.textContent =
                "All files uploaded. Creating GitHub commit...";


            const {
                data: commitData,
                error: commitError
            } = await supabaseClient.functions.invoke(
                "github-create-commit",
                {
                    body: {
                        gameSlug:
                            currentGame.slug,

                        version:
                            version,

                        files:
                            uploadedFiles,

                        commitMessage:
                            `Add ${currentGame.name} ${version}`
                    }
                }
            );


            if (commitError) {

                console.error(
                    "Commit error:",
                    commitError
                );

                throw new Error(
                    commitError.message ||
                    "Could not create GitHub commit."
                );
            }


            if (
                !commitData ||
                !commitData.success
            ) {

                throw new Error(
                    commitData?.error ||
                    "GitHub commit failed."
                );
            }


            /* =========================
               SAVE BUILD METADATA
            ========================= */

            formMessage.textContent =
                "GitHub upload successful. Saving build...";


            const buildUrl =
                commitData.url;


            if (!buildUrl) {

                throw new Error(
                    "GitHub upload succeeded, but no build URL was returned."
                );
            }


            const {
                data: build,
                error: buildError
            } = await supabaseClient
                .from("builds")
                .insert({
                    game_id:
                        currentGame.id,

                    version:
                        version,

                    build_date:
                        buildDate,

                    status:
                        status,

                    description:
                        description,

                    url:
                        buildUrl
                })
                .select()
                .single();


            if (buildError) {

                console.error(buildError);

                throw new Error(
                    "Build was uploaded to GitHub, but could not be saved in Supabase."
                );
            }


            /* =========================
               SAVE CHANGELOG
            ========================= */

            if (changes.length > 0) {

                const changelogRows =
                    changes.map(change => ({
                        build_id:
                            build.id,

                        change_text:
                            change
                    }));


                const {
                    error: changelogError
                } = await supabaseClient
                    .from("build_changelog")
                    .insert(
                        changelogRows
                    );


                if (changelogError) {

                    console.error(
                        changelogError
                    );

                    formMessage.textContent =
                        "Build uploaded and saved, but changelog could not be saved.";

                    await loadBuilds();

                    return;
                }
            }


            /* =========================
               SUCCESS
            ========================= */

            formMessage.textContent =
                "Build successfully uploaded!";


            addBuildForm.reset();


            selectedFilesText.textContent =
                "No files selected.";


            resetChangelog();


            await loadBuilds();

        }

        catch (error) {

            console.error(error);

            formMessage.textContent =
                error.message ||
                "Something went wrong while uploading the build.";
        }

    }
);


/* =========================
   RESET CHANGELOG
========================= */

function resetChangelog() {

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

}


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


function formatBytes(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        parseFloat(
            (
                bytes /
                Math.pow(1024, i)
            ).toFixed(2)
        ) +
        " " +
        units[i]
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


/* =========================
   ARRAY BUFFER → BASE64
========================= */

function arrayBufferToBase64(buffer) {

    const bytes =
        new Uint8Array(buffer);

    const chunkSize =
        0x8000;

    let binary = "";


    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {

        const chunk =
            bytes.subarray(
                i,
                Math.min(
                    i + chunkSize,
                    bytes.length
                )
            );


        binary += String.fromCharCode(
            ...chunk
        );
    }


    return btoa(binary);

}


/* =========================
   START
========================= */

loadGame();