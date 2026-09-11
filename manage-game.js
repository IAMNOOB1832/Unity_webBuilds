let currentUser = null;
let currentProfile = null;
let currentGame = null;
let allBuilds = [];
let selectedFiles = [];
let selectedUploadMethod = "automatic";

const params = new URLSearchParams(window.location.search);
const gameId = params.get("id");

document.addEventListener("DOMContentLoaded", async () => {
    if (!gameId) {
        window.location.href = "games.html";
        return;
    }

    setupUploadMethodButtons();
    setupFileInput();
    setupVersionAutoFormat();
    setupForm();

    await loadCurrentUser();
});

async function loadCurrentUser() {
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

    if (profileError || !profile) {
        alert("Profiel kon niet worden geladen.");
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    currentProfile = profile;

    if (profile.is_suspended === true) {
        alert("Je account is geschorst.");
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    await loadGame();
    await loadBuilds();
}

async function loadGame() {
    const { data: game, error } =
        await supabaseClient
            .from("games")
            .select("*")
            .eq("id", gameId)
            .single();

    if (error || !game) {
        alert("Game niet gevonden.");
        window.location.href = "games.html";
        return;
    }

    /*
     * Alleen de eigenaar mag deze manage-pagina gebruiken.
     */
    if (game.owner_id !== currentUser.id) {
        alert("Je bent geen eigenaar van deze game.");
        window.location.href = "games.html";
        return;
    }

    currentGame = game;

    const titleElement =
        document.getElementById("game-title");

    const slugElement =
        document.getElementById("game-slug");

    const descriptionElement =
        document.getElementById("game-description");

    if (titleElement) {
        titleElement.textContent = game.name;
    }

    if (slugElement) {
        slugElement.textContent = game.slug;
    }

    if (descriptionElement) {
        descriptionElement.textContent =
            game.description || "No description provided.";
    }

    updateManualBuildInfo();
}

async function loadBuilds() {
    const { data: builds, error } =
        await supabaseClient
            .from("builds")
            .select("*")
            .eq("game_id", gameId)
            .order("build_date", {
                ascending: false
            });

    if (error) {
        console.error(
            "Builds load error:",
            error
        );
        return;
    }

    allBuilds = builds || [];

    renderBuilds();
}

function renderBuilds() {
    const container =
        document.getElementById("build-list");

    if (!container) {
        return;
    }

    if (allBuilds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No builds yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML =
        allBuilds
            .map((build) => {
                const status =
                    escapeHTML(
                        build.status || "Unknown"
                    );

                const version =
                    escapeHTML(
                        build.version || "Unknown"
                    );

                const description =
                    escapeHTML(
                        build.description || ""
                    );

                const buildDate =
                    build.build_date
                        ? new Date(
                              build.build_date
                          ).toLocaleDateString()
                        : "Unknown date";

                return `
                    <div class="build-card">
                        <div class="build-card-header">
                            <div>
                                <h3>${version}</h3>
                                <span class="build-date">
                                    ${escapeHTML(buildDate)}
                                </span>
                            </div>

                            <span class="build-status">
                                ${status}
                            </span>
                        </div>

                        ${
                            description
                                ? `
                            <p class="build-description">
                                ${description}
                            </p>
                        `
                                : ""
                        }

                        <div class="build-actions">
                            ${
                                build.url
                                    ? `
                                <a
                                    href="${escapeAttribute(build.url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="btn btn-primary"
                                >
                                    Play Build
                                </a>
                            `
                                    : ""
                            }

                            <button
                                type="button"
                                class="btn btn-danger delete-build-button"
                                data-build-id="${escapeAttribute(build.id)}"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                `;
            })
            .join("");

    document
        .querySelectorAll(".delete-build-button")
        .forEach((button) => {
            button.addEventListener(
                "click",
                async () => {
                    await deleteBuild(
                        button.dataset.buildId
                    );
                }
            );
        });
}

function setupUploadMethodButtons() {
    const automaticButton =
        document.getElementById(
            "automatic-method-button"
        );

    const manualButton =
        document.getElementById(
            "manual-method-button"
        );

    const methodInput =
        document.getElementById(
            "upload-method"
        );

    const automaticSection =
        document.getElementById(
            "automatic-upload-section"
        );

    const manualSection =
        document.getElementById(
            "manual-upload-section"
        );

    if (
        !automaticButton ||
        !manualButton ||
        !automaticSection ||
        !manualSection
    ) {
        return;
    }

    function selectMethod(method) {
        selectedUploadMethod = method;

        if (methodInput) {
            methodInput.value = method;
        }

        if (method === "automatic") {
            automaticButton.classList.add("active");
            manualButton.classList.remove("active");

            automaticSection.style.display =
                "block";

            manualSection.style.display =
                "none";
        } else {
            automaticButton.classList.remove("active");
            manualButton.classList.add("active");

            automaticSection.style.display =
                "none";

            manualSection.style.display =
                "block";

            updateManualBuildInfo();
        }
    }

    automaticButton.addEventListener(
        "click",
        () => selectMethod("automatic")
    );

    manualButton.addEventListener(
        "click",
        () => selectMethod("manual")
    );

    selectMethod("automatic");
}

function setupFileInput() {
    const fileInput =
        document.getElementById("build-files");

    const selectedFilesElement =
        document.getElementById(
            "selected-files"
        );

    if (!fileInput) {
        return;
    }

    fileInput.addEventListener(
        "change",
        () => {
            selectedFiles =
                Array.from(
                    fileInput.files || []
                );

            if (!selectedFilesElement) {
                return;
            }

            if (selectedFiles.length === 0) {
                selectedFilesElement.textContent =
                    "No files selected.";
                return;
            }

            const totalSize =
                selectedFiles.reduce(
                    (total, file) =>
                        total + file.size,
                    0
                );

            selectedFilesElement.textContent =
                `${selectedFiles.length} file(s) selected — ${formatBytes(
                    totalSize
                )}`;
        }
    );
}

function setupVersionAutoFormat() {
    const versionInput =
        document.getElementById("version");

    if (!versionInput) {
        return;
    }

    versionInput.addEventListener(
        "blur",
        () => {
            let value =
                versionInput.value.trim();

            if (!value) {
                return;
            }

            if (!/^v/i.test(value)) {
                value = `v${value}`;
            }

            versionInput.value =
                value;
        }
    );

    versionInput.addEventListener(
        "input",
        () => {
            updateManualBuildInfo();
        }
    );
}

function setupForm() {
    const form =
        document.getElementById(
            "add-build-form"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            if (
                selectedUploadMethod ===
                "manual"
            ) {
                await submitManualBuild();
            } else {
                await submitAutomaticBuild();
            }
        }
    );
}

async function submitAutomaticBuild() {
    if (!currentGame) {
        alert("Game is nog niet geladen.");
        return;
    }

    const versionInput =
        document.getElementById("version");

    const buildDateInput =
        document.getElementById(
            "build-date"
        );

    const statusInput =
        document.getElementById("status");

    const descriptionInput =
        document.getElementById(
            "build-description"
        );

    const changelogInput =
        document.getElementById(
            "changelog"
        );

    const submitButton =
        document.getElementById(
            "submit-build-button"
        );

    const version =
        versionInput?.value.trim() || "";

    const buildDate =
        buildDateInput?.value || "";

    const status =
        statusInput?.value || "Development";

    const description =
        descriptionInput?.value.trim() || "";

    const changelog =
        changelogInput?.value.trim() || "";

    if (
        !/^v\d+(?:\.\d+)*$/i.test(
            version
        )
    ) {
        alert(
            "Gebruik een geldige versie, bijvoorbeeld v0.1 of v1.0."
        );
        return;
    }

    if (!buildDate) {
        alert("Kies een build date.");
        return;
    }

    if (selectedFiles.length === 0) {
        alert(
            "Selecteer eerst je Unity WebGL build."
        );
        return;
    }

    /*
     * Controleer maximale bestandsgrootte.
     * 60 MB frontend-limiet blijft behouden.
     */
    const MAX_FILE_SIZE =
        60 * 1024 * 1024;

    const oversizedFile =
        selectedFiles.find(
            (file) =>
                file.size >
                MAX_FILE_SIZE
        );

    if (oversizedFile) {
        alert(
            `"${oversizedFile.name}" is groter dan 60 MB. Gebruik de handmatige GitHub-route voor grote bestanden.`
        );
        return;
    }

    setSubmitButtonState(
        submitButton,
        true,
        "Uploading..."
    );

    try {
        /*
         * Upload alle bestanden één voor één.
         * Hierdoor vermijden we de memory limit van
         * de Supabase Edge Function.
         */
        for (
            let i = 0;
            i < selectedFiles.length;
            i++
        ) {
            const file =
                selectedFiles[i];

            setSubmitButtonState(
                submitButton,
                true,
                `Uploading ${i + 1}/${selectedFiles.length}...`
            );

            const base64 =
                await fileToBase64(file);

            const relativePath =
                getRelativeFilePath(file);

            const { data, error } =
                await supabaseClient.functions.invoke(
                    "github-upload-file",
                    {
                        body: {
                            gameSlug:
                                currentGame.slug,
                            version,
                            filePath:
                                relativePath,
                            contentBase64:
                                base64
                        }
                    }
                );

            if (error) {
                console.error(
                    "File upload error:",
                    error
                );

                throw new Error(
                    getFunctionErrorMessage(
                        error,
                        `Upload van ${file.name} mislukt.`
                    )
                );
            }

            if (
                data?.success !== true
            ) {
                throw new Error(
                    data?.error ||
                        `Upload van ${file.name} mislukt.`
                );
            }
        }

        setSubmitButtonState(
            submitButton,
            true,
            "Creating GitHub commit..."
        );

        /*
         * Maak de Git commit nadat alle blobs
         * succesvol zijn aangemaakt.
         */
        const filesForCommit =
            selectedFiles.map(
                (file) => ({
                    path:
                        getRelativeFilePath(
                            file
                        ),
                    size: file.size
                })
            );

        const { data: commitData, error: commitError } =
            await supabaseClient.functions.invoke(
                "github-create-commit",
                {
                    body: {
                        gameSlug:
                            currentGame.slug,
                        version,
                        files:
                            filesForCommit,
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
                getFunctionErrorMessage(
                    commitError,
                    "GitHub commit mislukt."
                )
            );
        }

        if (
            commitData?.success !== true
        ) {
            throw new Error(
                commitData?.error ||
                    "GitHub commit mislukt."
            );
        }

        /*
         * URL uit Edge Function gebruiken wanneer beschikbaar.
         */
        const buildUrl =
            commitData?.buildUrl ||
            getBuildUrl(version);

        setSubmitButtonState(
            submitButton,
            true,
            "Saving build..."
        );

        const build =
            await saveBuildMetadata({
                version,
                buildDate,
                status,
                description,
                buildUrl
            });

        if (!build) {
            throw new Error(
                "Build is geüpload, maar kon niet worden opgeslagen in Supabase."
            );
        }

        await saveChangelog(
            build.id,
            changelog
        );

        await saveUploadLog(
            build.id
        );

        alert(
            `Build ${version} is succesvol geüpload!`
        );

        window.location.reload();
    } catch (error) {
        console.error(
            "Automatic build upload failed:",
            error
        );

        alert(
            error?.message ||
                "Er ging iets mis tijdens het uploaden."
        );

        setSubmitButtonState(
            submitButton,
            false,
            "Upload Build"
        );
    }
}

async function submitManualBuild() {
    if (!currentGame) {
        alert("Game is nog niet geladen.");
        return;
    }

    const versionInput =
        document.getElementById("version");

    const buildDateInput =
        document.getElementById(
            "build-date"
        );

    const statusInput =
        document.getElementById("status");

    const descriptionInput =
        document.getElementById(
            "build-description"
        );

    const changelogInput =
        document.getElementById(
            "changelog"
        );

    const confirmation =
        document.getElementById(
            "manual-upload-confirmation"
        );

    const submitButton =
        document.getElementById(
            "submit-build-button"
        );

    const version =
        versionInput?.value.trim() || "";

    const buildDate =
        buildDateInput?.value || "";

    const status =
        statusInput?.value || "Development";

    const description =
        descriptionInput?.value.trim() || "";

    const changelog =
        changelogInput?.value.trim() || "";

    if (
        !/^v\d+(?:\.\d+)*$/i.test(
            version
        )
    ) {
        alert(
            "Gebruik een geldige versie, bijvoorbeeld v0.1 of v1.0."
        );
        return;
    }

    if (!buildDate) {
        alert("Kies een build date.");
        return;
    }

    if (
        !confirmation ||
        confirmation.checked !== true
    ) {
        alert(
            "Bevestig eerst dat de build naar GitHub is geüpload."
        );
        return;
    }

    setSubmitButtonState(
        submitButton,
        true,
        "Checking GitHub..."
    );

    try {
        /*
         * Server-side controle:
         * - ingelogde gebruiker
         * - suspended status
         * - admin
         * - game ownership
         * - duplicate version
         * - index.html bestaat op GitHub
         */
        const {
            data,
            error
        } =
            await supabaseClient.functions.invoke(
                "verify-github-build",
                {
                    body: {
                        gameSlug:
                            currentGame.slug,
                        version
                    }
                }
            );

        if (error) {
            console.error(
                "GitHub verification error:",
                error
            );

            throw new Error(
                getFunctionErrorMessage(
                    error,
                    "GitHub build kon niet worden gecontroleerd."
                )
            );
        }

        if (
            data?.success !== true ||
            data?.verified !== true
        ) {
            throw new Error(
                data?.error ||
                    "GitHub build kon niet worden geverifieerd."
            );
        }

        const buildUrl =
            data.buildUrl ||
            getBuildUrl(version);

        setSubmitButtonState(
            submitButton,
            true,
            "Saving build..."
        );

        const build =
            await saveBuildMetadata({
                version,
                buildDate,
                status,
                description,
                buildUrl
            });

        if (!build) {
            throw new Error(
                "Build kon niet worden opgeslagen."
            );
        }

        await saveChangelog(
            build.id,
            changelog
        );

        await saveUploadLog(
            build.id
        );

        alert(
            `Handmatige build ${version} is succesvol geregistreerd!`
        );

        window.location.reload();
    } catch (error) {
        console.error(
            "Manual build registration failed:",
            error
        );

        alert(
            error?.message ||
                "Er ging iets mis tijdens het registreren van de build."
        );

        setSubmitButtonState(
            submitButton,
            false,
            "Register Build"
        );
    }
}

async function saveBuildMetadata({
    version,
    buildDate,
    status,
    description,
    buildUrl
}) {
    const { data, error } =
        await supabaseClient
            .from("builds")
            .insert({
                game_id:
                    currentGame.id,
                version,
                build_date:
                    buildDate,
                status,
                description,
                url:
                    buildUrl
            })
            .select()
            .single();

    if (error) {
        console.error(
            "Build insert error:",
            error
        );

        /*
         * Als de versie al bestaat, geven we een
         * duidelijke melding.
         */
        if (
            error.code ===
            "23505"
        ) {
            throw new Error(
                `Versie ${version} bestaat al voor deze game.`
            );
        }

        throw new Error(
            "Build kon niet worden opgeslagen."
        );
    }

    return data;
}

async function saveChangelog(
    buildId,
    changelog
) {
    if (!changelog) {
        return;
    }

    const lines =
        changelog
            .split("\n")
            .map((line) =>
                line.trim()
            )
            .filter(Boolean);

    if (lines.length === 0) {
        return;
    }

    const rows =
        lines.map(
            (changeText) => ({
                build_id:
                    buildId,
                change_text:
                    changeText
            })
        );

    const { error } =
        await supabaseClient
            .from("build_changelog")
            .insert(rows);

    if (error) {
        console.error(
            "Changelog insert error:",
            error
        );

        throw new Error(
            "Build is opgeslagen, maar de changelog kon niet worden opgeslagen."
        );
    }
}

async function saveUploadLog(
    buildId
) {
    const {
        error
    } =
        await supabaseClient
            .from("upload_logs")
            .insert({
                user_id:
                    currentUser.id,
                build_id:
                    buildId
            });

    if (error) {
        console.error(
            "Upload log insert error:",
            error
        );

        /*
         * De build is al succesvol opgeslagen.
         * Daarom gooien we hier geen error die de
         * hele upload als mislukt presenteert.
         */
        alert(
            "Build opgeslagen, maar de upload usage kon niet worden geregistreerd."
        );
    }
}

async function deleteBuild(
    buildId
) {
    if (!buildId) {
        return;
    }

    const build =
        allBuilds.find(
            (item) =>
                item.id ===
                buildId
        );

    if (!build) {
        return;
    }

    const confirmed =
        confirm(
            `Weet je zeker dat je build ${build.version} wilt verwijderen?`
        );

    if (!confirmed) {
        return;
    }

    try {
        /*
         * Verwijder changelog eerst.
         */
        const {
            error: changelogError
        } =
            await supabaseClient
                .from(
                    "build_changelog"
                )
                .delete()
                .eq(
                    "build_id",
                    buildId
                );

        if (changelogError) {
            console.error(
                "Changelog delete error:",
                changelogError
            );
        }

        /*
         * Upload log wordt bewust NIET verwijderd.
         *
         * Een verwijderde build blijft dus meetellen
         * voor de wekelijkse uploadlimiet.
         */

        const { error } =
            await supabaseClient
                .from("builds")
                .delete()
                .eq(
                    "id",
                    buildId
                )
                .eq(
                    "game_id",
                    currentGame.id
                );

        if (error) {
            throw error;
        }

        alert(
            "Build verwijderd."
        );

        await loadBuilds();
    } catch (error) {
        console.error(
            "Delete build error:",
            error
        );

        alert(
            "Build kon niet worden verwijderd."
        );
    }
}

function updateManualBuildInfo() {
    const versionInput =
        document.getElementById("version");

    const folderPathElement =
        document.getElementById(
            "manual-folder-path"
        );

    const buildUrlElement =
        document.getElementById(
            "manual-build-url"
        );

    if (
        !currentGame ||
        !versionInput
    ) {
        return;
    }

    const version =
        versionInput.value.trim();

    if (!version) {
        if (folderPathElement) {
            folderPathElement.textContent =
                `${currentGame.slug}/v0.1/`;
        }

        if (buildUrlElement) {
            buildUrlElement.textContent =
                getBuildUrl("v0.1");
        }

        return;
    }

    if (folderPathElement) {
        folderPathElement.textContent =
            `${currentGame.slug}/${version}/`;
    }

    if (buildUrlElement) {
        buildUrlElement.textContent =
            getBuildUrl(version);
    }
}

function getBuildUrl(
    version
) {
    return `https://597405.github.io/GameBuildFilesUnityWeb/${encodeURIComponent(
        currentGame.slug
    )}/${encodeURIComponent(
        version
    )}/`;
}

function getRelativeFilePath(
    file
) {
    /*
     * webkitRelativePath is bijvoorbeeld:
     *
     * Pancakeria/v0.1/Build/game.wasm
     *
     * We willen alleen:
     *
     * Build/game.wasm
     *
     * omdat gameSlug/version door de Edge Function
     * zelf worden toegevoegd.
     */
    let path =
        file.webkitRelativePath ||
        file.name;

    const parts =
        path
            .split("/")
            .filter(Boolean);

    /*
     * Verwijder game root en version root wanneer
     * de browser deze heeft meegegeven.
     */
    if (
        parts.length >= 3 &&
        currentGame &&
        parts[0] ===
            currentGame.name
    ) {
        parts.shift();
    }

    if (
        parts.length >= 3 &&
        /^v\d+(?:\.\d+)*$/i.test(
            parts[0]
        )
    ) {
        parts.shift();
    }

    return parts.join("/");
}

function fileToBase64(
    file
) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onload = () => {
                const result =
                    reader.result;

                if (
                    typeof result !==
                    "string"
                ) {
                    reject(
                        new Error(
                            `Kon ${file.name} niet lezen.`
                        )
                    );
                    return;
                }

                const commaIndex =
                    result.indexOf(
                        ","
                    );

                if (
                    commaIndex === -1
                ) {
                    reject(
                        new Error(
                            `Kon Base64-data voor ${file.name} niet verwerken.`
                        )
                    );
                    return;
                }

                resolve(
                    result.slice(
                        commaIndex + 1
                    )
                );
            };

            reader.onerror = () => {
                reject(
                    new Error(
                        `Kon ${file.name} niet lezen.`
                    )
                );
            };

            reader.readAsDataURL(
                file
            );
        }
    );
}

function setSubmitButtonState(
    button,
    disabled,
    text
) {
    if (!button) {
        return;
    }

    button.disabled =
        disabled;

    if (text) {
        button.textContent =
            text;
    }
}

function getFunctionErrorMessage(
    error,
    fallback
) {
    if (
        error?.context?.body
    ) {
        try {
            const body =
                typeof error.context.body ===
                "string"
                    ? JSON.parse(
                          error.context.body
                      )
                    : error.context.body;

            if (
                body?.error
            ) {
                return body.error;
            }
        } catch {
            // Ignore JSON parse errors.
        }
    }

    if (
        error?.message &&
        !error.message.includes(
            "non-2xx"
        )
    ) {
        return error.message;
    }

    return fallback;
}

function formatBytes(
    bytes
) {
    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {
        return "0 Bytes";
    }

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const index =
        Math.floor(
            Math.log(bytes) /
                Math.log(1024)
        );

    const unitIndex =
        Math.min(
            index,
            units.length - 1
        );

    return `${(
        bytes /
        Math.pow(
            1024,
            unitIndex
        )
    ).toFixed(
        unitIndex === 0
            ? 0
            : 2
    )} ${units[unitIndex]}`;
}

function escapeHTML(
    value
) {
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

function escapeAttribute(
    value
) {
    return escapeHTML(value);
}

/*
 * Logout
 */
const logoutButton =
    document.getElementById(
        "logout-button"
    );

if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        async () => {
            await supabaseClient.auth.signOut();
            window.location.href =
                "login.html";
        }
    );
}

/*
 * Cancel button
 */
const cancelButton =
    document.getElementById(
        "cancel-build-button"
    );

if (cancelButton) {
    cancelButton.addEventListener(
        "click",
        () => {
            window.location.href =
                `manage-game.html?id=${encodeURIComponent(
                    gameId
                )}`;
        }
    );
}

/*
 * GitHub link
 */
const openGithubButton =
    document.getElementById(
        "open-github-button"
    );

if (openGithubButton) {
    openGithubButton.addEventListener(
        "click",
        () => {
            window.open(
                "https://github.com/597405/GameBuildFilesUnityWeb",
                "_blank",
                "noopener,noreferrer"
            );
        }
    );
}

/*
 * Build link
 */
const openBuildButton =
    document.getElementById(
        "open-build-button"
    );

if (openBuildButton) {
    openBuildButton.addEventListener(
        "click",
        () => {
            const versionInput =
                document.getElementById(
                    "version"
                );

            const version =
                versionInput?.value.trim();

            if (!version) {
                alert(
                    "Vul eerst een versie in."
                );
                return;
            }

            window.open(
                getBuildUrl(version),
                "_blank",
                "noopener,noreferrer"
            );
        }
    );
}