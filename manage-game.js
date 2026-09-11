const supabaseClient = window.supabaseClient;

let currentUser = null;
let currentProfile = null;
let currentGame = null;
let currentBuilds = [];
let selectedUploadMethod = "automatic";

const SUPABASE_FUNCTIONS_URL =
    "https://rfbsjpghlhcxqesvftta.supabase.co/functions/v1";

const GITHUB_PAGES_BASE =
    "https://597405.github.io/GameBuildFilesUnityWeb";


document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializePage();
    } catch (error) {
        console.error("Page initialization error:", error);
        showPageError("Er is iets misgegaan bij het laden van deze pagina.");
    }
});


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializePage() {
    if (!supabaseClient) {
        throw new Error(
            "supabaseClient is niet beschikbaar. Controleer de volgorde van de scripts in manage-game.html."
        );
    }

    setupLogout();
    setupUploadMethodButtons();
    setupAutomaticUpload();
    setupManualUpload();
    setupGameNameSlugHelpers();

    const userResult = await supabaseClient.auth.getUser();

    if (userResult.error) {
        console.error("Auth error:", userResult.error);
        redirectToLogin();
        return;
    }

    currentUser = userResult.data.user;

    if (!currentUser) {
        redirectToLogin();
        return;
    }

    await loadProfile();
    await loadGame();
    await loadBuilds();
    updateNavigation();
}


/* =========================================================
   AUTH / PROFILE
========================================================= */

async function loadProfile() {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {
        console.error("Profile error:", error);
        throw error;
    }

    currentProfile = data;

    if (currentProfile.is_suspended === true) {
        showPageError(
            "Je account is momenteel geschorst. Je kunt geen builds uploaden."
        );

        const submitButton = document.getElementById("submit-build-button");

        if (submitButton) {
            submitButton.disabled = true;
        }
    }
}


/* =========================================================
   GAME LOADING
========================================================= */

async function loadGame() {
    const params = new URLSearchParams(window.location.search);

    const gameSlug =
        params.get("slug") ||
        params.get("game") ||
        params.get("gameSlug");

    if (!gameSlug) {
        throw new Error("Geen game slug gevonden in de URL.");
    }

    const { data, error } = await supabaseClient
        .from("games")
        .select("*")
        .eq("slug", gameSlug)
        .single();

    if (error || !data) {
        console.error("Game error:", error);
        showPageError("Game niet gevonden.");
        return;
    }

    currentGame = data;

    /*
     * Alleen de eigenaar mag deze game beheren.
     * Ook admins kunnen hier niet omheen.
     */
    if (currentGame.owner_id !== currentUser.id) {
        showPageError(
            "Je bent geen eigenaar van deze game en kunt deze game niet beheren."
        );

        const submitButton = document.getElementById("submit-build-button");

        if (submitButton) {
            submitButton.disabled = true;
        }

        return;
    }

    renderGameInformation();
}


/* =========================================================
   GAME INFORMATION
========================================================= */

function renderGameInformation() {
    if (!currentGame) {
        return;
    }

    setText("game-title", currentGame.name);
    setText("game-name", currentGame.name);
    setText("game-slug", currentGame.slug);

    const descriptionElement =
        document.getElementById("game-description");

    if (descriptionElement) {
        descriptionElement.textContent =
            currentGame.description || "Geen beschrijving.";
    }

    const slugInput =
        document.getElementById("game-slug-input");

    if (slugInput) {
        slugInput.value = currentGame.slug;
    }

    const gameNameInput =
        document.getElementById("game-name-input");

    if (gameNameInput) {
        gameNameInput.value = currentGame.name;
    }

    updateManualBuildInformation();
}


/* =========================================================
   BUILD LOADING
========================================================= */

async function loadBuilds() {
    if (!currentGame) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("builds")
        .select("*")
        .eq("game_id", currentGame.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Build loading error:", error);
        return;
    }

    currentBuilds = data || [];

    renderBuilds();
}


/* =========================================================
   BUILD RENDERING
========================================================= */

function renderBuilds() {
    const container =
        document.getElementById("build-history") ||
        document.getElementById("build-list") ||
        document.getElementById("builds-list");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (currentBuilds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Er zijn nog geen builds voor deze game.</p>
            </div>
        `;

        return;
    }

    currentBuilds.forEach((build) => {
        const buildElement = document.createElement("div");

        buildElement.className = "build-card";

        const buildDate = build.build_date
            ? formatDate(build.build_date)
            : "Geen datum";

        const status = build.status || "unknown";

        const buildUrl =
            build.url ||
            getBuildUrl(build.version);

        buildElement.innerHTML = `
            <div class="build-card-content">

                <div class="build-card-main">

                    <div class="build-card-title-row">
                        <h3>${escapeHTML(build.version)}</h3>

                        <span class="build-status">
                            ${escapeHTML(status)}
                        </span>
                    </div>

                    <p class="build-date">
                        ${escapeHTML(buildDate)}
                    </p>

                    <p class="build-description">
                        ${escapeHTML(
                            build.description ||
                            "Geen beschrijving."
                        )}
                    </p>

                </div>

                <div class="build-card-actions">

                    ${
                        buildUrl
                            ? `
                                <a
                                    href="${escapeAttribute(buildUrl)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="button secondary"
                                >
                                    Open build
                                </a>
                              `
                            : ""
                    }

                    <button
                        type="button"
                        class="button danger delete-build-button"
                        data-build-id="${escapeAttribute(build.id)}"
                    >
                        Delete
                    </button>

                </div>

            </div>
        `;

        container.appendChild(buildElement);
    });

    container
        .querySelectorAll(".delete-build-button")
        .forEach((button) => {
            button.addEventListener("click", async () => {
                const buildId = button.dataset.buildId;

                await deleteBuild(buildId);
            });
        });
}


/* =========================================================
   UPLOAD METHOD BUTTONS
========================================================= */

function setupUploadMethodButtons() {
    const automaticButton =
        document.getElementById("automatic-method-button");

    const manualButton =
        document.getElementById("manual-method-button");

    if (automaticButton) {
        automaticButton.addEventListener("click", () => {
            selectUploadMethod("automatic");
        });
    }

    if (manualButton) {
        manualButton.addEventListener("click", () => {
            selectUploadMethod("manual");
        });
    }

    selectUploadMethod("automatic");
}


function selectUploadMethod(method) {
    selectedUploadMethod = method;

    const automaticSection =
        document.getElementById("automatic-upload-section");

    const manualSection =
        document.getElementById("manual-upload-section");

    const automaticButton =
        document.getElementById("automatic-method-button");

    const manualButton =
        document.getElementById("manual-method-button");

    const methodInput =
        document.getElementById("upload-method");

    if (methodInput) {
        methodInput.value = method;
    }

    if (automaticSection) {
        automaticSection.style.display =
            method === "automatic" ? "block" : "none";
    }

    if (manualSection) {
        manualSection.style.display =
            method === "manual" ? "block" : "none";
    }

    if (automaticButton) {
        automaticButton.classList.toggle(
            "active",
            method === "automatic"
        );
    }

    if (manualButton) {
        manualButton.classList.toggle(
            "active",
            method === "manual"
        );
    }

    updateManualBuildInformation();
}


/* =========================================================
   AUTOMATIC UPLOAD
========================================================= */

function setupAutomaticUpload() {
    const form =
        document.getElementById("build-upload-form");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (selectedUploadMethod === "manual") {
            await handleManualUpload();

            return;
        }

        await handleAutomaticUpload();
    });
}


async function handleAutomaticUpload() {
    clearMessages();

    if (!currentUser || !currentGame) {
        showUploadError("Game of gebruiker kon niet worden geladen.");
        return;
    }

    if (currentProfile?.is_suspended === true) {
        showUploadError(
            "Je account is geschorst. Uploaden is niet mogelijk."
        );

        return;
    }

    const version = getVersionValue();

    const buildDate = getBuildDateValue();

    const description = getBuildDescriptionValue();

    const filesInput = getFilesInput();

    if (!version) {
        showUploadError("Vul een versie in.");

        return;
    }

    if (!isValidVersion(version)) {
        showUploadError(
            "Gebruik een versie zoals v0.1, v0.2 of v1.0.0."
        );

        return;
    }

    if (!filesInput || !filesInput.files || filesInput.files.length === 0) {
        showUploadError(
            "Selecteer eerst de Unity WebGL build bestanden."
        );

        return;
    }

    /*
     * Controleer dubbele versie lokaal alvast.
     * De server controleert dit ook.
     */
    const duplicate = currentBuilds.some(
        (build) =>
            String(build.version).toLowerCase() ===
            version.toLowerCase()
    );

    if (duplicate) {
        showUploadError(
            `Versie ${version} bestaat al voor deze game.`
        );

        return;
    }

    const files = Array.from(filesInput.files);

    /*
     * Automatische route houdt een veilige limiet aan.
     * Grote bestanden kunnen via de handmatige route.
     */
    const MAX_FILE_SIZE = 60 * 1024 * 1024;

    const oversizedFile = files.find(
        (file) => file.size > MAX_FILE_SIZE
    );

    if (oversizedFile) {
        showUploadError(
            `${oversizedFile.name} is groter dan 60 MB. ` +
            `Gebruik voor deze grote build de handmatige GitHub-route.`
        );

        return;
    }

    setUploadLoading(true);

    try {
        showUploadProgress(
            `Build voorbereiden... (${files.length} bestanden)`
        );

        const uploadedFiles = [];

        for (let index = 0; index < files.length; index++) {
            const file = files[index];

            showUploadProgress(
                `Bestand ${index + 1} van ${files.length}: ${file.name}`
            );

            const base64 = await fileToBase64(file);

            const relativePath =
                getRelativeFilePath(file);

            const result =
                await invokeFunction(
                    "github-upload-file",
                    {
                        gameSlug: currentGame.slug,
                        version,
                        filePath: relativePath,
                        contentBase64: base64
                    }
                );

            uploadedFiles.push({
                path: relativePath,
                sha: result.sha,
                size: result.size
            });
        }

        showUploadProgress(
            "GitHub bestanden staan klaar. Build committen..."
        );

        const commitResult =
            await invokeFunction(
                "github-create-commit",
                {
                    gameSlug: currentGame.slug,
                    version,
                    files: uploadedFiles,
                    commitMessage:
                        `Add ${currentGame.name} ${version}`
                }
            );

        const buildUrl =
            commitResult.buildUrl ||
            getBuildUrl(version);

        const build =
            await createBuildMetadata({
                version,
                buildDate,
                description,
                buildUrl
            });

        await createChangelogEntries(build.id);

        await createUploadLog(build.id);

        showUploadSuccess(
            `Build ${version} is succesvol geüpload.`
        );

        resetUploadForm();

        await loadBuilds();

        if (buildUrl) {
            showBuildLink(buildUrl);
        }

    } catch (error) {
        console.error("Automatic upload error:", error);

        showUploadError(
            getFriendlyErrorMessage(
                error,
                "De automatische upload is mislukt."
            )
        );

    } finally {
        setUploadLoading(false);
    }
}


/* =========================================================
   MANUAL GITHUB UPLOAD
========================================================= */

function setupManualUpload() {
    const confirmation =
        document.getElementById(
            "manual-upload-confirmation"
        );

    if (confirmation) {
        confirmation.addEventListener("change", () => {
            updateManualSubmitButton();
        });
    }

    updateManualBuildInformation();
    updateManualSubmitButton();
}


async function handleManualUpload() {
    clearMessages();

    if (!currentUser || !currentGame) {
        showUploadError(
            "Game of gebruiker kon niet worden geladen."
        );

        return;
    }

    if (currentProfile?.is_suspended === true) {
        showUploadError(
            "Je account is geschorst. Uploaden is niet mogelijk."
        );

        return;
    }

    const version = getVersionValue();

    const buildDate = getBuildDateValue();

    const description = getBuildDescriptionValue();

    if (!version) {
        showUploadError("Vul een versie in.");

        return;
    }

    if (!isValidVersion(version)) {
        showUploadError(
            "Gebruik een versie zoals v0.1, v0.2 of v1.0.0."
        );

        return;
    }

    const confirmation =
        document.getElementById(
            "manual-upload-confirmation"
        );

    if (confirmation && !confirmation.checked) {
        showUploadError(
            "Bevestig eerst dat je de build naar GitHub hebt geüpload."
        );

        return;
    }

    const duplicate = currentBuilds.some(
        (build) =>
            String(build.version).toLowerCase() ===
            version.toLowerCase()
    );

    if (duplicate) {
        showUploadError(
            `Versie ${version} bestaat al voor deze game.`
        );

        return;
    }

    setUploadLoading(true);

    try {
        showUploadProgress(
            "GitHub build controleren..."
        );

        /*
         * verify-github-build controleert server-side:
         *
         * - ingelogde gebruiker
         * - suspended status
         * - game ownership
         * - dubbele versie
         * - GitHub index.html
         * - correcte repository
         */
        const verification =
            await invokeFunction(
                "verify-github-build",
                {
                    gameSlug: currentGame.slug,
                    version
                }
            );

        if (!verification.success) {
            throw new Error(
                verification.error ||
                "GitHub build kon niet worden geverifieerd."
            );
        }

        const buildUrl =
            verification.buildUrl ||
            getBuildUrl(version);

        showUploadProgress(
            "GitHub build is gevonden. Metadata opslaan..."
        );

        const build =
            await createBuildMetadata({
                version,
                buildDate,
                description,
                buildUrl
            });

        await createChangelogEntries(build.id);

        await createUploadLog(build.id);

        showUploadSuccess(
            `Handmatige build ${version} is succesvol geregistreerd.`
        );

        resetUploadForm();

        await loadBuilds();

        if (buildUrl) {
            showBuildLink(buildUrl);
        }

    } catch (error) {
        console.error("Manual upload error:", error);

        showUploadError(
            getFriendlyErrorMessage(
                error,
                "De handmatige build kon niet worden geregistreerd."
            )
        );

    } finally {
        setUploadLoading(false);
    }
}


/* =========================================================
   SUPABASE BUILD METADATA
========================================================= */

async function createBuildMetadata({
    version,
    buildDate,
    description,
    buildUrl
}) {
    const { data, error } =
        await supabaseClient
            .from("builds")
            .insert({
                game_id: currentGame.id,
                version,
                build_date: buildDate || null,
                status: "published",
                description: description || "",
                url: buildUrl || null
            })
            .select("*")
            .single();

    if (error) {
        console.error(
            "Build metadata error:",
            error
        );

        throw error;
    }

    return data;
}


/* =========================================================
   CHANGELOG
========================================================= */

async function createChangelogEntries(buildId) {
    const changelog =
        getChangelogValue();

    if (!changelog || !buildId) {
        return;
    }

    /*
     * Ondersteunt meerdere regels.
     *
     * Voorbeeld:
     *
     * Added new level
     * Fixed player movement
     * Improved UI
     */
    const lines =
        changelog
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

    if (lines.length === 0) {
        return;
    }

    const rows = lines.map((changeText) => ({
        build_id: buildId,
        change_text: changeText
    }));

    const { error } =
        await supabaseClient
            .from("build_changelog")
            .insert(rows);

    if (error) {
        console.error(
            "Changelog error:",
            error
        );

        throw error;
    }
}


/* =========================================================
   UPLOAD LOG
========================================================= */

async function createUploadLog(buildId) {
    if (!buildId || !currentUser) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("upload_logs")
            .insert({
                user_id: currentUser.id,
                build_id: buildId
            });

    if (error) {
        /*
         * De build bestaat al en is geüpload.
         * Als alleen de usage-log faalt, willen we de gebruiker
         * niet vertellen dat de hele build mislukt is.
         */
        console.error(
            "Upload log error:",
            error
        );

        showUploadWarning(
            "Build is geüpload, maar de upload usage kon niet worden geregistreerd."
        );
    }
}


/* =========================================================
   DELETE BUILD
========================================================= */

async function deleteBuild(buildId) {
    if (!buildId) {
        return;
    }

    const build =
        currentBuilds.find(
            (item) => item.id === buildId
        );

    if (!build) {
        return;
    }

    const confirmed =
        window.confirm(
            `Weet je zeker dat je build ${build.version} wilt verwijderen uit de database?`
        );

    if (!confirmed) {
        return;
    }

    try {
        /*
         * Eerst ownership opnieuw controleren.
         */
        if (
            !currentGame ||
            currentGame.owner_id !== currentUser.id
        ) {
            showUploadError(
                "Je bent geen eigenaar van deze game."
            );

            return;
        }

        const { error } =
            await supabaseClient
                .from("build_changelog")
                .delete()
                .eq("build_id", buildId);

        if (error) {
            console.error(
                "Changelog delete error:",
                error
            );
        }

        const { error: buildError } =
            await supabaseClient
                .from("builds")
                .delete()
                .eq("id", buildId)
                .eq("game_id", currentGame.id);

        if (buildError) {
            throw buildError;
        }

        /*
         * BELANGRIJK:
         *
         * upload_logs wordt bewust NIET verwijderd.
         * Een verwijderde build moet blijven meetellen voor
         * de wekelijkse uploadlimiet.
         */

        showUploadSuccess(
            `Build ${build.version} is uit de database verwijderd.`
        );

        await loadBuilds();

    } catch (error) {
        console.error(
            "Delete build error:",
            error
        );

        showUploadError(
            getFriendlyErrorMessage(
                error,
                "De build kon niet worden verwijderd."
            )
        );
    }
}


/* =========================================================
   MANUAL BUILD INFORMATION
========================================================= */

function updateManualBuildInformation() {
    if (!currentGame) {
        return;
    }

    const version = getVersionValue();

    const folderPath =
        version
            ? `${currentGame.slug}/${version}/`
            : `${currentGame.slug}/v0.1/`;

    const buildUrl =
        version
            ? getBuildUrl(version)
            : getBuildUrl("v0.1");

    const folderElement =
        document.getElementById(
            "manual-folder-path"
        );

    if (folderElement) {
        folderElement.textContent = folderPath;
    }

    const urlElement =
        document.getElementById(
            "manual-build-url"
        );

    if (urlElement) {
        urlElement.textContent = buildUrl;
    }

    const githubButton =
        document.getElementById(
            "open-github-button"
        );

    if (githubButton) {
        githubButton.href =
            "https://github.com/597405/GameBuildFilesUnityWeb";
    }

    const buildButton =
        document.getElementById(
            "open-build-button"
        );

    if (buildButton) {
        buildButton.href = buildUrl;
    }
}


function updateManualSubmitButton() {
    const submitButton =
        document.getElementById(
            "submit-build-button"
        );

    if (!submitButton) {
        return;
    }

    const confirmation =
        document.getElementById(
            "manual-upload-confirmation"
        );

    if (
        selectedUploadMethod === "manual" &&
        confirmation
    ) {
        submitButton.disabled =
            !confirmation.checked;
    } else {
        submitButton.disabled = false;
    }
}


/* =========================================================
   VERSION / INPUT HELPERS
========================================================= */

function setupGameNameSlugHelpers() {
    const versionInput =
        getVersionInput();

    if (versionInput) {
        versionInput.addEventListener(
            "input",
            () => {
                updateManualBuildInformation();
            }
        );
    }
}


function getVersionInput() {
    return (
        document.getElementById("build-version") ||
        document.getElementById("version") ||
        document.getElementById("version-input")
    );
}


function getVersionValue() {
    const input = getVersionInput();

    return input
        ? input.value.trim()
        : "";
}


function getBuildDateValue() {
    const input =
        document.getElementById("build-date") ||
        document.getElementById("date") ||
        document.getElementById("build-date-input");

    return input
        ? input.value
        : "";
}


function getBuildDescriptionValue() {
    const input =
        document.getElementById("build-description") ||
        document.getElementById("description") ||
        document.getElementById("build-description-input");

    return input
        ? input.value.trim()
        : "";
}


function getChangelogValue() {
    const input =
        document.getElementById("build-changelog") ||
        document.getElementById("changelog") ||
        document.getElementById("changelog-input");

    return input
        ? input.value.trim()
        : "";
}


function getFilesInput() {
    return (
        document.getElementById("build-files") ||
        document.getElementById("files") ||
        document.getElementById("file-input") ||
        document.querySelector(
            'input[type="file"][webkitdirectory]'
        ) ||
        document.querySelector(
            'input[type="file"]'
        )
    );
}


/* =========================================================
   FILE HANDLING
========================================================= */

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const result =
                    String(reader.result);

                const commaIndex =
                    result.indexOf(",");

                if (commaIndex === -1) {
                    reject(
                        new Error(
                            "Bestand kon niet naar Base64 worden omgezet."
                        )
                    );

                    return;
                }

                resolve(
                    result.substring(
                        commaIndex + 1
                    )
                );

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(
                new Error(
                    `Kon ${file.name} niet lezen.`
                )
            );
        };

        reader.readAsDataURL(file);
    });
}


function getRelativeFilePath(file) {
    let path =
        file.webkitRelativePath ||
        file.name;

    path =
        path
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

    const parts =
        path
            .split("/")
            .filter(Boolean);

    /*
     * Als de browser de geselecteerde rootfolder
     * meestuurt, verwijderen we die.
     *
     * Voorbeeld:
     *
     * v0.1/index.html
     *      ↓
     * index.html
     *
     * of:
     *
     * Pancakeria/v0.1/Build/game.wasm
     *      ↓
     * Build/game.wasm
     */

    if (parts.length > 1) {
        if (
            currentGame &&
            parts[0].toLowerCase() ===
            currentGame.slug.toLowerCase()
        ) {
            parts.shift();
        }

        if (
            parts.length > 1 &&
            /^v\d+(?:\.\d+)*$/i.test(parts[0])
        ) {
            parts.shift();
        }

        /*
         * Wanneer de rootfolder bijvoorbeeld "WebBuild"
         * heet, verwijderen we alleen die eerste map.
         */
        if (
            parts.length > 1 &&
            !isRootBuildFile(parts[0])
        ) {
            /*
             * Alleen uitvoeren wanneer de oorspronkelijke path
             * nog uit meerdere onderdelen bestaat en de eerste
             * map geen bekende Unity buildmap is.
             */
        }
    }

    return parts.join("/");
}


function isRootBuildFile(name) {
    const knownDirectories = [
        "Build",
        "TemplateData",
        "StreamingAssets",
        "Plugins"
    ];

    return knownDirectories.some(
        (directory) =>
            directory.toLowerCase() ===
            String(name).toLowerCase()
    );
}


/* =========================================================
   VALIDATION
========================================================= */

function isValidVersion(version) {
    return /^v\d+(?:\.\d+)*$/i.test(version);
}


/* =========================================================
   EDGE FUNCTION HELPER
========================================================= */

async function invokeFunction(
    functionName,
    body
) {
    const sessionResult =
        await supabaseClient.auth.getSession();

    if (sessionResult.error) {
        throw sessionResult.error;
    }

    const session =
        sessionResult.data.session;

    if (!session) {
        redirectToLogin();

        throw new Error(
            "Je sessie is verlopen. Log opnieuw in."
        );
    }

    const response =
        await fetch(
            `${SUPABASE_FUNCTIONS_URL}/${functionName}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${session.access_token}`,

                    "apikey":
                        getSupabaseAnonKey()
                },

                body: JSON.stringify(body)
            }
        );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const error =
            new Error(
                data?.error ||
                data?.message ||
                `Edge Function returned ${response.status}`
            );

        error.status =
            response.status;

        error.data = data;

        throw error;
    }

    return data;
}


/*
 * De Supabase publishable key staat al in supabase.js.
 * We proberen die daar veilig uit te lezen zonder de key
 * ergens opnieuw hardcoded in manage-game.js te zetten.
 */
function getSupabaseAnonKey() {
    /*
     * Sommige projecten hebben de key niet globaal beschikbaar.
     *
     * In dat geval is de Authorization header voldoende voor
     * de Edge Function, maar de apikey header wordt door
     * Supabase doorgaans ook verwacht.
     */

    if (
        typeof window.SUPABASE_KEY === "string" &&
        window.SUPABASE_KEY
    ) {
        return window.SUPABASE_KEY;
    }

    /*
     * Als supabase.js alleen:
     *
     * const SUPABASE_KEY = "...";
     *
     * gebruikt, is deze const niet bereikbaar vanuit dit script.
     *
     * Daarom wordt geprobeerd om via de client intern geen
     * gevoelige service-role informatie te gebruiken.
     */
    return "";
}


/* =========================================================
   NAVIGATION
========================================================= */

function updateNavigation() {
    const adminNavLink =
        document.getElementById(
            "admin-nav-link"
        );

    if (!adminNavLink) {
        return;
    }

    if (
        currentProfile &&
        currentProfile.is_admin === true
    ) {
        adminNavLink.style.display =
            "inline-block";
    } else {
        adminNavLink.style.display =
            "none";
    }
}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {
    const logoutButton =
        document.getElementById("logout-button");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {
            try {
                await supabaseClient.auth.signOut();
            } catch (error) {
                console.error(
                    "Logout error:",
                    error
                );
            }

            window.location.href =
                "login.html";
        }
    );
}


/* =========================================================
   URL HELPERS
========================================================= */

function getBuildUrl(version) {
    if (!currentGame || !version) {
        return "";
    }

    return (
        `${GITHUB_PAGES_BASE}/` +
        `${encodeURIComponent(currentGame.slug)}/` +
        `${encodeURIComponent(version)}/`
    );
}


/* =========================================================
   FORM RESET
========================================================= */

function resetUploadForm() {
    const form =
        document.getElementById(
            "build-upload-form"
        );

    if (!form) {
        return;
    }

    /*
     * Game/slug velden niet resetten als ze in dezelfde
     * form aanwezig zijn.
     */

    const versionInput =
        getVersionInput();

    if (versionInput) {
        versionInput.value = "";
    }

    const descriptionInput =
        document.getElementById(
            "build-description"
        ) ||
        document.getElementById(
            "description"
        ) ||
        document.getElementById(
            "build-description-input"
        );

    if (descriptionInput) {
        descriptionInput.value = "";
    }

    const changelogInput =
        document.getElementById(
            "build-changelog"
        ) ||
        document.getElementById(
            "changelog"
        ) ||
        document.getElementById(
            "changelog-input"
        );

    if (changelogInput) {
        changelogInput.value = "";
    }

    const fileInput =
        getFilesInput();

    if (fileInput) {
        fileInput.value = "";
    }

    const confirmation =
        document.getElementById(
            "manual-upload-confirmation"
        );

    if (confirmation) {
        confirmation.checked = false;
    }

    updateManualBuildInformation();
    updateManualSubmitButton();
}


/* =========================================================
   UI HELPERS
========================================================= */

function setUploadLoading(isLoading) {
    const submitButton =
        document.getElementById(
            "submit-build-button"
        );

    if (!submitButton) {
        return;
    }

    if (isLoading) {
        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent =
            "Uploading...";

        submitButton.disabled = true;
    } else {
        submitButton.textContent =
            submitButton.dataset.originalText ||
            "Upload build";

        updateManualSubmitButton();
    }
}


function showUploadProgress(message) {
    const element =
        document.getElementById(
            "upload-message"
        ) ||
        document.getElementById(
            "build-message"
        ) ||
        document.getElementById(
            "form-message"
        );

    if (!element) {
        console.log(message);
        return;
    }

    element.textContent = message;
    element.className =
        "form-message";
}


function showUploadSuccess(message) {
    const element =
        getMessageElement();

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className =
        "form-message success";
}


function showUploadWarning(message) {
    const element =
        getMessageElement();

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className =
        "form-message warning";
}


function showUploadError(message) {
    const element =
        getMessageElement();

    if (!element) {
        alert(message);
        return;
    }

    element.textContent = message;
    element.className =
        "form-message error";
}


function clearMessages() {
    const element =
        getMessageElement();

    if (!element) {
        return;
    }

    element.textContent = "";
    element.className =
        "form-message";
}


function getMessageElement() {
    return (
        document.getElementById(
            "upload-message"
        ) ||
        document.getElementById(
            "build-message"
        ) ||
        document.getElementById(
            "form-message"
        )
    );
}


function showBuildLink(url) {
    if (!url) {
        return;
    }

    const message =
        getMessageElement();

    if (!message) {
        return;
    }

    message.innerHTML =
        `Build klaar: ` +
        `<a href="${escapeAttribute(url)}" ` +
        `target="_blank" ` +
        `rel="noopener noreferrer">` +
        `Open build` +
        `</a>`;
}


function showPageError(message) {
    const container =
        document.getElementById(
            "page-message"
        ) ||
        document.getElementById(
            "upload-message"
        );

    if (container) {
        container.textContent = message;
        container.className =
            "form-message error";
    } else {
        console.error(message);
    }
}


/* =========================================================
   ERROR HANDLING
========================================================= */

function getFriendlyErrorMessage(
    error,
    fallback
) {
    if (!error) {
        return fallback;
    }

    if (error.status === 409) {
        return (
            error.data?.error ||
            "Deze versie bestaat al."
        );
    }

    if (error.status === 403) {
        return (
            error.data?.error ||
            "Je hebt geen toestemming voor deze actie."
        );
    }

    if (error.status === 401) {
        return (
            error.data?.error ||
            "Je sessie is verlopen. Log opnieuw in."
        );
    }

    if (error.status === 413) {
        return (
            "Het bestand is te groot voor de automatische upload. " +
            "Gebruik de handmatige GitHub-route."
        );
    }

    if (
        error.message &&
        error.message.includes(
            "Sorry, your input was too large"
        )
    ) {
        return (
            "GitHub accepteerde dit grote bestand niet via de automatische API. " +
            "Gebruik de handmatige GitHub-route."
        );
    }

    return (
        error.data?.error ||
        error.message ||
        fallback
    );
}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
    return escapeHTML(value);
}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {
    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleDateString(
        "nl-NL",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );
}


/* =========================================================
   LOGIN
========================================================= */

function redirectToLogin() {
    window.location.href =
        "login.html";
}


/* =========================================================
   SIMPLE DOM HELPERS
========================================================= */

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        value || "";
}
