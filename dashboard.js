const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const welcomeTitle = document.getElementById("welcome-title");
const gamesList = document.getElementById("games-list");
const logoutButton = document.getElementById("logout-button");
const addGameButton = document.getElementById("add-game-button");

async function loadDashboard() {
    // Check login
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    // Load profile
    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("username, display_name, is_admin, is_suspended")
            .eq("id", user.id)
            .single();

    if (profileError || !profile) {
        gamesList.innerHTML =
            "<p>Could not load your profile.</p>";
        return;
    }

    // Suspended users cannot use the dashboard
    if (profile.is_suspended === true) {
        welcomeTitle.textContent = "Account suspended";

        gamesList.innerHTML = `
            <div class="build-card">
                <h2>Account suspended</h2>
                <p>
                    Your account is currently suspended.
                    Please contact the administrator.
                </p>
            </div>
        `;

        return;
    }

    welcomeTitle.textContent =
        `Welcome, ${profile.display_name || profile.username}.`;

    // Load games owned by this user
    const { data: games, error: gamesError } =
        await supabaseClient
            .from("games")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });

    if (gamesError) {
        console.error(gamesError);

        gamesList.innerHTML =
            "<p>Could not load your games.</p>";

        return;
    }

    if (!games || games.length === 0) {
        gamesList.innerHTML = `
            <div class="build-card">
                <h2>No games yet</h2>
                <p>
                    You haven't added a game yet.
                </p>
            </div>
        `;

        return;
    }

    gamesList.innerHTML = games.map(game => `
        <article class="build-card">
            <h2>${escapeHTML(game.name)}</h2>

            <p>
                ${escapeHTML(game.description || "No description.")}
            </p>

            <a
                href="game.html?slug=${encodeURIComponent(game.slug)}"
                class="btn primary"
            >
                View game
            </a>
        </article>
    `).join("");
}

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
});

addGameButton.addEventListener("click", () => {
    window.location.href = "add-game.html";
});

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadDashboard();
