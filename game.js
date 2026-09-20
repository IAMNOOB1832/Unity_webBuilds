/* =========================================
   GAME PAGE
========================================= */

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

/* =========================================
   ELEMENTS
========================================= */

const gameStatus = document.getElementById("game-status");
const gameName = document.getElementById("game-name");
const gameOwner = document.getElementById("game-owner");
const gameDescription = document.getElementById("game-description");
const latestContainer = document.getElementById("latest-build-container");
const historyContainer = document.getElementById("build-history");
const footerBuildCount = document.getElementById("footer-build-count");

/* =========================================
   GET GAME SLUG
========================================= */

const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

/* =========================================
   LOAD GAME
========================================= */

async function loadGame() {
    if (!slug) {
        showError("No game was specified.");
        return;
    }

    try {
        const { data: game, error: gameError } = await supabaseClient
            .from("games")
            .select(`id, name, slug, description, owner_id`)
            .eq("slug", slug)
            .single();

        if (gameError) throw gameError;

        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select(`username, display_name`)
            .eq("id", game.owner_id)
            .single();

        if (profileError) throw profileError;

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
                build_changelog (
                    change_text
                )
            `)
            .eq("game_id", game.id)
            .order("build_date", { ascending: false });

        if (buildsError) throw buildsError;

        document.title = `${game.name} — Build Archive`;
        gameName.textContent = game.name;

        const ownerName = profile?.display_name || profile?.username || "Unknown developer";
        gameOwner.textContent = `BY ${ownerName}`;
        gameDescription.textContent = game.description || "No description available.";

        gameStatus.innerHTML = `
            <span class="status-dot"></span>
            GAME IN DEVELOPMENT
        `;

        if (!Array.isArray(builds) || builds.length === 0) {
            latestContainer.innerHTML = `<div class="loading">No builds available yet.</div>`;
            historyContainer.innerHTML = `<div class="loading">No build history available yet.</div>`;
            footerBuildCount.textContent = "0 BUILDS";
        } else {
            renderLatestBuild(builds[0]);
            renderBuildHistory(builds);
            footerBuildCount.textContent = `${builds.length} ${builds.length === 1 ? "BUILD" : "BUILDS"}`;
        }

        // Laad de feedback & reviews van deze game
        await loadGameFeedback(game.id);

    } catch (error) {
        console.error("Could not load game:", error);
        showError("Unable to load this game.");
    }
}

/* =========================================
   LATEST BUILD
========================================= */

function renderLatestBuild(build) {
    const changelog = build.build_changelog || [];
    const isExe = build.build_type === "executable" || !!build.download_url;
    const targetUrl = isExe ? (build.download_url || build.url) : build.url;

    const changelogHTML = changelog.length > 0
        ? `
            <div class="changelog">
                <div class="changelog-title">WHAT'S NEW</div>
                <ul>
                    ${changelog.map(item => `<li>${escapeHTML(item.change_text)}</li>`).join("")}
                </ul>
            </div>
        `
        : "";

    const actionButton = isExe
        ? `
            <a href="${escapeAttribute(targetUrl)}" class="button button-primary play-latest" download>
                💾 DOWNLOAD LATEST .EXE
                <span>↓</span>
            </a>
          `
        : `
            <a href="${escapeAttribute(targetUrl)}" class="button button-primary play-latest">
                PLAY THIS BUILD
                <span>→</span>
            </a>
          `;

    latestContainer.innerHTML = `
        <div class="latest-card">
            <div class="build-top">
                <div>
                    <div class="version">${escapeHTML(build.version)}</div>
                    <div class="build-date">${escapeHTML(formatDate(build.build_date))}</div>
                </div>
                <div class="build-status">${escapeHTML(build.status)}</div>
            </div>

            <p class="build-description">${escapeHTML(build.description)}</p>

            ${changelogHTML}
            ${actionButton}
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

        const isExe = build.build_type === "executable" || !!build.download_url;
        const targetUrl = isExe ? (build.download_url || build.url) : build.url;

        const actionBtn = isExe
            ? `
                <a href="${escapeAttribute(targetUrl)}" class="play-small" download>
                    💾 DOWNLOAD
                    <span>↓</span>
                </a>
              `
            : `
                <a href="${escapeAttribute(targetUrl)}" class="play-small">
                    PLAY
                    <span>→</span>
                </a>
              `;

        item.innerHTML = `
            <div class="history-version">
                ${escapeHTML(build.version)}
            </div>
            <div class="history-date">
                ${escapeHTML(formatDate(build.build_date))}
            </div>
            <div class="history-description">
                ${escapeHTML(build.description)}
            </div>
            <div class="history-action">
                ${actionBtn}
            </div>
        `;

        historyContainer.appendChild(item);
    });
}

/* =========================================
   FEEDBACK, RATING & DELETE LOGIC
========================================= */

const starRatingContainer = document.getElementById("star-rating");
const selectedRatingInput = document.getElementById("selected-rating");
const ratingText = document.getElementById("rating-text");
const feedbackForm = document.getElementById("feedback-form");
const feedbackMessage = document.getElementById("feedback-message");
const feedbackList = document.getElementById("feedback-list");
const averageRatingStars = document.getElementById("average-rating-stars");
const averageRatingText = document.getElementById("average-rating-text");

let currentSelectedRating = 0;
let currentUserId = null;

async function initFeedbackUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) currentUserId = user.id;
}

/* 1. STERREN INTERACTIE */
if (starRatingContainer) {
    const stars = starRatingContainer.querySelectorAll("span");

    stars.forEach((star) => {
        star.addEventListener("click", () => {
            const val = parseInt(star.dataset.value);
            currentSelectedRating = currentSelectedRating === val ? 0 : val;

            selectedRatingInput.value = currentSelectedRating;
            ratingText.textContent = `${currentSelectedRating} / 5 stars selected`;

            stars.forEach((s) => {
                const sVal = parseInt(s.dataset.value);
                s.textContent = sVal <= currentSelectedRating ? "★" : "☆";
                s.style.color = sVal <= currentSelectedRating ? "#00e5a0" : "#fff";
            });
        });
    });
}

/* 2. HAAL FEEDBACK & GEMIDDELDE SCORE OP */
async function loadGameFeedback(gameId) {
    if (!feedbackList) return;

    await initFeedbackUser();

    const { data: feedbackData, error } = await supabaseClient
        .from("game_feedback")
        .select(`
            id,
            rating,
            comment,
            created_at,
            user_id,
            profiles (
                username,
                display_name
            )
        `)
        .eq("game_id", gameId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Fout bij ophalen feedback:", error);
        feedbackList.innerHTML = "<p>Could not load reviews.</p>";
        return;
    }

    if (!feedbackData || feedbackData.length === 0) {
        feedbackList.innerHTML = "<p style='color:#888;'>No reviews left for this game yet.</p>";
        if (averageRatingStars) averageRatingStars.textContent = "☆☆☆☆☆";
        if (averageRatingText) averageRatingText.textContent = "0 / 5 (0 reviews)";
        return;
    }

    const totalRating = feedbackData.reduce((acc, curr) => acc + curr.rating, 0);
    const avg = (totalRating / feedbackData.length).toFixed(1);

    if (averageRatingText) averageRatingText.textContent = `${avg} / 5 (${feedbackData.length} ${feedbackData.length === 1 ? 'review' : 'reviews'})`;
    if (averageRatingStars) {
        const roundedAvg = Math.round(avg);
        averageRatingStars.textContent = "★".repeat(roundedAvg) + "☆".repeat(5 - roundedAvg);
    }

    feedbackList.innerHTML = feedbackData.map(item => {
        const authorName = item.profiles?.display_name || item.profiles?.username || "Anonymous player";
        const starsText = "★".repeat(item.rating) + "☆".repeat(5 - item.rating);
        const dateStr = new Date(item.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
        const isOwner = currentUserId && item.user_id === currentUserId;

        return `
            <div class="feedback-card" style="padding: 18px; background: rgba(255, 255, 255, 0.03); border: 1px solid #222; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <strong style="color: #fff; font-size: 16px;">${escapeHTML(authorName)}</strong>
                        <span style="color: #00e5a0; margin-left: 10px; font-size: 16px; letter-spacing: 1px;">${starsText}</span>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${dateStr}</div>
                    </div>
                    ${isOwner ? `
                        <button 
                            type="button" 
                            class="delete-feedback-btn" 
                            data-id="${item.id}"
                            style="background: transparent; color: #ff4d4d; border: 1px solid #ff4d4d; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                        >
                            Delete
                        </button>
                    ` : ''}
                </div>
                ${item.comment ? `<p style="margin-top: 12px; color: #ddd; line-height: 1.5;">${escapeHTML(item.comment)}</p>` : ''}
            </div>
        `;
    }).join("");

    document.querySelectorAll(".delete-feedback-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteFeedback(btn.dataset.id, gameId));
    });
}

/* 3. VERWIJDER FEEDBACK LOGICA */
async function deleteFeedback(feedbackId, gameId) {
    if (!confirm("Are you sure you want to delete your review?")) return;

    const { error } = await supabaseClient
        .from("game_feedback")
        .delete()
        .eq("id", feedbackId);

    if (error) {
        alert("Could not delete review.");
        console.error(error);
        return;
    }

    await loadGameFeedback(gameId);
}

/* 4. FORMULIER VERSTUREN */
if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!slug) return;

        try {
            feedbackMessage.textContent = "Submitting review...";

            const { data: gameData, error: gameError } = await supabaseClient
                .from("games")
                .select("id")
                .eq("slug", slug)
                .single();

            if (gameError || !gameData) throw new Error("Game not found.");

            const { data: { user } } = await supabaseClient.auth.getUser();
            const comment = document.getElementById("feedback-comment").value.trim();

            const { error: insertError } = await supabaseClient
                .from("game_feedback")
                .insert({
                    game_id: gameData.id,
                    user_id: user ? user.id : null,
                    rating: currentSelectedRating,
                    comment: comment || null
                });

            if (insertError) throw insertError;

            feedbackMessage.style.color = "#00e5a0";
            feedbackMessage.textContent = "Thank you for your review!";
            feedbackForm.reset();

            currentSelectedRating = 0;
            selectedRatingInput.value = 0;
            ratingText.textContent = "0 / 5 stars selected";
            starRatingContainer.querySelectorAll("span").forEach(s => {
                s.textContent = "☆";
                s.style.color = "#fff";
            });

            await loadGameFeedback(gameData.id);

        } catch (error) {
            console.error("Feedback error:", error);
            feedbackMessage.style.color = "#ff4d4d";
            feedbackMessage.textContent = error.message || "Could not submit review.";
        }
    });
}

/* =========================================
   DATE / ERROR / SECURITY
========================================= */

function formatDate(date) {
    if (!date) return "";
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return String(date);
    return parsedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function showError(message) {
    gameStatus.innerHTML = `<span class="status-dot"></span>ERROR`;
    gameName.textContent = "Game unavailable";
    gameOwner.textContent = "";
    gameDescription.textContent = message;
    latestContainer.innerHTML = `<div class="loading">${escapeHTML(message)}</div>`;
    historyContainer.innerHTML = "";
}

function escapeHTML(value) {
    if (value === undefined || value === null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    if (value === undefined || value === null) return "#";
    return String(value)
        .replace(/"/g, "%22")
        .replace(/</g, "%3C")
        .replace(/>/g, "%3E");
}

loadGame();