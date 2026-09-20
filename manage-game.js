const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const gameName = document.getElementById("game-name");
const gameDescription = document.getElementById("game-description");
const buildsList = document.getElementById("builds-list");
const logoutButton = document.getElementById("logout-button");
const showAddBuildButton = document.getElementById("show-add-build-button");
const addBuildSection = document.getElementById("add-build-section");
const cancelAddBuildButton = document.getElementById("cancel-add-build-button");
const addBuildForm = document.getElementById("add-build-form");
const addChangeButton = document.getElementById("add-change-button");
const changelogList = document.getElementById("changelog-list");
const formMessage = document.getElementById("form-message");

const unityBuildInput = document.getElementById("unity-build");
const selectedFilesText = document.getElementById("selected-files");

// Upload modus & Build type elementen
const uploadModeRadios = document.querySelectorAll('input[name="upload-mode"]');
const buildTypeRadios = document.querySelectorAll('input[name="build-type"]');
const autoUploadBox = document.getElementById("auto-upload-box");
const manualUploadBox = document.getElementById("manual-upload-box");
const manualSlugHint = document.getElementById("manual-slug-hint");
const manualVersionHint = document.getElementById("manual-version-hint");
const uploadInstructionText = document.getElementById("upload-instruction-text");
const versionInput = document.getElementById("version");

const params = new URLSearchParams(window.location.search);
const gameId = params.get("id");

let currentUser = null;
let currentGame = null;

/* =========================
   UPLOAD MODE & TYPE TOGGLES
========================= */

function updateFormInputsState() {
    const uploadMode = (document.querySelector('input[name="upload-mode"]:checked') || {}).value || "auto";
    const buildType = (document.querySelector('input[name="build-type"]:checked') || {}).value || "web";

    if (uploadMode === "manual") {
        if (autoUploadBox) autoUploadBox.style.display = "none";
        if (manualUploadBox) manualUploadBox.style.display = "block";
        if (unityBuildInput) unityBuildInput.removeAttribute("required");
    } else {
        if (autoUploadBox) autoUploadBox.style.display = "block";
        if (manualUploadBox) manualUploadBox.style.display = "none";
        if (unityBuildInput) unityBuildInput.setAttribute("required", "true");
    }

    if (buildType === "executable") {
        if (unityBuildInput) {
            unityBuildInput.removeAttribute("webkitdirectory");
            unityBuildInput.removeAttribute("directory");
            unityBuildInput.setAttribute("accept", ".zip,.exe,.rar,.7z");
        }
        if (uploadInstructionText) uploadInstructionText.textContent = "Select your .zip or .exe build file.";
        if (selectedFilesText && (!unityBuildInput || !unityBuildInput.files.length)) {
            selectedFilesText.textContent = "No .zip / .exe selected.";
        }
    } else {
        if (unityBuildInput) {
            unityBuildInput.setAttribute("webkitdirectory", "");
            unityBuildInput.setAttribute("directory", "");
            unityBuildInput.removeAttribute("accept");
        }
        if (uploadInstructionText) uploadInstructionText.textContent = "Select the complete WebGL build folder.";
        if (selectedFilesText && (!unityBuildInput || !unityBuildInput.files.length)) {
            selectedFilesText.textContent = "No WebGL folder selected.";
        }
    }
}

uploadModeRadios.forEach(radio => radio.addEventListener("change", updateFormInputsState));
buildTypeRadios.forEach(radio => radio.addEventListener("change", updateFormInputsState));

if (versionInput) {
    versionInput.addEventListener("input", (e) => {
        if (manualVersionHint) {
            manualVersionHint.textContent = e.target.value || "v...";
        }
    });
}

/* =========================
   LOAD PAGE
========================= */

async function loadGame() {
    if (!gameId) {
        gameName.textContent = "Game not found";
        gameDescription.textContent = "No game ID was provided.";
        buildsList.innerHTML = "<p>Invalid game.</p>";
        return;
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    const { data: game, error: gameError } = await supabaseClient
        .from("games")
        .select(`id, name, slug, description, owner_id`)
        .eq("id", gameId)
        .single();

    if (gameError || !game) {
        console.error(gameError);
        gameName.textContent = "Game not found";
        gameDescription.textContent = "";
        buildsList.innerHTML = "<p>Could not load this game.</p>";
        return;
    }

    if (game.owner_id !== currentUser.id) {
        gameName.textContent = "Access denied";
        gameDescription.textContent = "You do not own this game.";
        buildsList.innerHTML = "<p>You cannot manage this game.</p>";
        if (showAddBuildButton) showAddBuildButton.style.display = "none";
        return;
    }

    currentGame = game;
    gameName.textContent = game.name;
    gameDescription.textContent = game.description || "No description.";

    if (manualSlugHint) manualSlugHint.textContent = game.slug;

    await loadBuilds();

    if (params.get("action") === "add-build") {
        showAddBuildForm();
    }
}

/* =========================
   LOAD BUILDS
========================= */

async function loadBuilds() {
    const { data: builds, error: buildsError } = await supabaseClient
        .from("builds")
        .select(`
            id,
            version,
            build_date,
            status,
            description,
            url,
            build_type,
            download_url,
            created_at,
            build_changelog (
                id,
                change_text,
                created_at
            )
        `)
        .eq("game_id", gameId)
        .order("build_date", { ascending: false });

    if (buildsError) {
        console.error(buildsError);
        buildsList.innerHTML = "<p>Could not load builds.</p>";
        return;
    }

    if (!builds || builds.length === 0) {
        buildsList.innerHTML = `
            <div class="build-card">
                <h2>No builds yet</h2>
                <p>This game doesn't have any builds yet.</p>
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
    buildsList.innerHTML = builds.map(build => {
        const changelog = Array.isArray(build.build_changelog) ? build.build_changelog : [];
        const isExe = build.build_type === "executable" || !!build.download_url;

        const changelogHTML = changelog.length > 0
            ? `<ul>${changelog.map(c => `<li>${escapeHTML(c.change_text)}</li>`).join("")}</ul>`
            : `<p>No changelog entries.</p>`;

        const targetUrl = isExe ? (build.download_url || build.url) : build.url;
        const btnText = isExe ? "💾 Download .exe" : "Play build";

        return `
            <article class="build-card">
                <span class="eyebrow">${isExe ? "DESKTOP BUILD (.EXE)" : "WEBGL BUILD"}</span>
                <h2>${escapeHTML(build.version)}</h2>
                <p><strong>${escapeHTML(build.status)}</strong></p>
                <p>${formatDate(build.build_date)}</p>
                <p>${escapeHTML(build.description || "")}</p>

                <div style="margin-top:20px;">
                    <span class="eyebrow">WHAT'S NEW</span>
                    ${changelogHTML}
                </div>

                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:20px;">
                    <a href="${escapeAttribute(targetUrl)}" class="btn primary" target="_blank" rel="noopener">
                        ${btnText}
                    </a>
                    <button type="button" class="btn delete-build-button" data-build-id="${escapeAttribute(build.id)}">
                        Delete
                    </button>
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll(".delete-build-button").forEach(button => {
        button.addEventListener("click", () => deleteBuild(button.dataset.buildId));
    });
}

/* =========================
   ADD BUILD FORM TOGGLES
========================= */

function showAddBuildForm() {
    addBuildSection.style.display = "block";
    addBuildSection.scrollIntoView({ behavior: "smooth" });
}

function hideAddBuildForm() {
    addBuildSection.style.display = "none";
    formMessage.textContent = "";
}

if (showAddBuildButton) showAddBuildButton.addEventListener("click", showAddBuildForm);
if (cancelAddBuildButton) cancelAddBuildButton.addEventListener("click", hideAddBuildForm);

if (unityBuildInput) {
    unityBuildInput.addEventListener("change", () => {
        const files = Array.from(unityBuildInput.files || []);
        if (files.length === 0) {
            selectedFilesText.textContent = "No files selected.";
            return;
        }

        const buildType = (document.querySelector('input[name="build-type"]:checked') || {}).value || "web";

        if (buildType === "executable") {
            const file = files[0];
            selectedFilesText.textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
        } else {
            const hasIndex = files.some(file => {
                const relativePath = file.webkitRelativePath || file.name;
                return relativePath.split("/").pop().toLowerCase() === "index.html";
            });
            const totalSize = files.reduce((total, file) => total + file.size, 0);

            selectedFilesText.textContent = `${files.length} file(s) selected.` +
                (hasIndex ? " Unity index.html found." : " WARNING: index.html was not found.") +
                ` Total size: ${formatBytes(totalSize)}.`;
        }
    });
}

/* =========================
   CHANGELOG
========================= */

if (addChangeButton) {
    addChangeButton.addEventListener("click", () => {
        const row = document.createElement("div");
        row.className = "change-row";
        row.style.marginTop = "10px";
        row.innerHTML = `
            <input type="text" class="change-input" placeholder="What changed?" required>
            <button type="button" class="btn remove-change-button">Remove</button>
        `;
        changelogList.appendChild(row);
        row.querySelector(".remove-change-button").addEventListener("click", () => row.remove());
    });
}

/* =========================
   SUBMIT BUILD FORM
========================= */

addBuildForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentGame || !currentUser) return;

    try {
        formMessage.textContent = "Preparing build...";

        const version = document.getElementById("version").value.trim();
        const buildDate = document.getElementById("build-date").value;
        const status = document.getElementById("status").value;
        const description = document.getElementById("description").value.trim();
        const changes = [...document.querySelectorAll(".change-input")]
            .map(input => input.value.trim())
            .filter(Boolean);

        const uploadMode = (document.querySelector('input[name="upload-mode"]:checked') || {}).value || "auto";
        const buildType = (document.querySelector('input[name="build-type"]:checked') || {}).value || "web";

        if (!version || !buildDate || !status || !description) {
            formMessage.textContent = "Please fill in all required fields.";
            return;
        }

        if (!/^v\d+(?:\.\d+)*$/i.test(version)) {
            formMessage.textContent = "Version must look like v0.2.";
            return;
        }

        let buildUrl = "";
        let downloadUrl = null;

        if (uploadMode === "manual") {
            // Manual Upload Flow (zoekt automatisch index.html of .zip op GitHub)
            formMessage.textContent = "Verifying manual upload on GitHub...";

            const { data: verifyData, error: verifyError } = await supabaseClient.functions.invoke("verify-github-build", {
                body: { 
                    gameSlug: currentGame.slug, 
                    version: version,
                    buildType: buildType
                }
            });

            if (verifyError || !verifyData?.success) {
                throw new Error(verifyError?.message || verifyData?.error || "GitHub verification failed.");
            }

            buildUrl = verifyData.buildUrl;
            if (buildType === "executable") {
                downloadUrl = verifyData.buildUrl;
            }

        } else {
            // Auto Upload Flow
            if (buildType === "executable") {
                const files = Array.from(unityBuildInput.files || []);
                if (files.length === 0) {
                    formMessage.textContent = "Please select a .zip or .exe file.";
                    return;
                }

                const exeFile = files[0];
                formMessage.textContent = `Uploading executable build (${formatBytes(exeFile.size)})...`;

                const arrayBuffer = await exeFile.arrayBuffer();
                const base64 = arrayBufferToBase64(arrayBuffer);

                const { data: exeUploadData, error: exeUploadError } = await supabaseClient.functions.invoke(
                    "upload-executable-build",
                    {
                        body: {
                            gameSlug: currentGame.slug,
                            version: version,
                            fileName: exeFile.name,
                            contentBase64: base64
                        }
                    }
                );

                if (exeUploadError || !exeUploadData?.success) {
                    throw new Error(exeUploadError?.message || exeUploadData?.error || "Executable upload failed.");
                }

                downloadUrl = exeUploadData.downloadUrl;
                buildUrl = exeUploadData.downloadUrl;

            } else {
                // WebGL Auto Upload
                const files = Array.from(unityBuildInput.files || []);
                if (files.length === 0) {
                    formMessage.textContent = "Please select your WebGL build folder.";
                    return;
                }

                const indexFile = files.find(file => {
                    const relativePath = file.webkitRelativePath || file.name;
                    return relativePath.split("/").pop().toLowerCase() === "index.html";
                });

                if (!indexFile) {
                    formMessage.textContent = "The selected folder does not contain index.html.";
                    return;
                }

                const uploadedFiles = [];

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    let relativePath = file.webkitRelativePath || file.name;
                    const pathParts = relativePath.split("/").filter(Boolean);

                    if (pathParts.length > 1) pathParts.shift();
                    relativePath = pathParts.join("/");

                    if (!relativePath) throw new Error("Invalid file path.");

                    formMessage.textContent = `Uploading file ${i + 1}/${files.length}: ${relativePath}`;

                    const arrayBuffer = await file.arrayBuffer();
                    const base64 = arrayBufferToBase64(arrayBuffer);

                    const { data: uploadData, error: uploadError } = await supabaseClient.functions.invoke(
                        "github-upload-file",
                        {
                            body: {
                                gameSlug: currentGame.slug,
                                version: version,
                                filePath: relativePath,
                                contentBase64: base64
                            }
                        }
                    );

                    if (uploadError || !uploadData?.success) {
                        throw new Error(uploadError?.message || uploadData?.error || `Could not upload ${relativePath}.`);
                    }

                    uploadedFiles.push({ path: relativePath, sha: uploadData.sha });
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                formMessage.textContent = "All files uploaded. Creating GitHub commit...";

                const { data: commitData, error: commitError } = await supabaseClient.functions.invoke(
                    "github-create-commit",
                    {
                        body: {
                            gameSlug: currentGame.slug,
                            version: version,
                            files: uploadedFiles,
                            commitMessage: `Add ${currentGame.name} ${version}`
                        }
                    }
                );

                if (commitError || !commitData?.success) {
                    throw new Error(commitError?.message || commitData?.error || "GitHub commit failed.");
                }

                buildUrl = commitData.url;
            }
        }

        formMessage.textContent = "Saving build metadata...";

        const { data: build, error: buildError } = await supabaseClient
            .from("builds")
            .insert({
                game_id: currentGame.id,
                version: version,
                build_date: buildDate,
                status: status,
                description: description,
                url: buildUrl,
                build_type: buildType,
                download_url: downloadUrl
            })
            .select()
            .single();

        if (buildError) {
            if (buildError.code === '23505') {
                throw new Error(`Version ${version} already exists in the database for this game.`);
            }
            throw new Error("Build was processed, but could not be saved in Supabase.");
        }

        if (changes.length > 0) {
            const changelogRows = changes.map(change => ({
                build_id: build.id,
                change_text: change
            }));

            await supabaseClient.from("build_changelog").insert(changelogRows);
        }

        await supabaseClient.from("upload_logs").insert({
            user_id: currentUser.id,
            build_id: build.id
        });

        formMessage.textContent = "Build successfully registered and published!";
        addBuildForm.reset();
        if (selectedFilesText) selectedFilesText.textContent = "No files selected.";
        resetChangelog();
        await loadBuilds();

        setTimeout(() => { hideAddBuildForm(); }, 1500);

    } catch (error) {
        console.error(error);
        formMessage.textContent = error.message || "Something went wrong while processing the build.";
    }
});

/* =========================
   RESET CHANGELOG & DELETE
========================= */

function resetChangelog() {
    changelogList.innerHTML = `
        <div class="change-row">
            <input type="text" class="change-input" placeholder="What changed?" required>
            <button type="button" class="btn remove-change-button">Remove</button>
        </div>
    `;
    changelogList.querySelector(".remove-change-button").addEventListener("click", event => {
        event.target.closest(".change-row").remove();
    });
}

async function deleteBuild(buildId) {
    if (!window.confirm("Are you sure you want to delete this build?")) return;

    await supabaseClient.from("build_changelog").delete().eq("build_id", buildId);
    const { error } = await supabaseClient.from("builds").delete().eq("id", buildId);

    if (error) {
        alert("Could not delete the build.");
        return;
    }

    await loadBuilds();
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });
}

function formatDate(date) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + units[i];
}

function escapeHTML(value) {
    if (value === undefined || value === null) return "";
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    if (value === undefined || value === null) return "#";
    return String(value).replaceAll("&", "%26").replaceAll('"', "%22").replaceAll("<", "%3C").replaceAll(">", "%3E").replaceAll(" ", "%20");
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

loadGame();