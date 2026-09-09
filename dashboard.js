const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const welcomeTitle = document.getElementById("welcome-title");
const gamesList = document.getElementById("games-list");
const logoutButton = document.getElementById("logout-button");
const addGameButton = document.getElementById("add-game-button");
const quickActions = document.getElementById("quick-actions");
const accountInfo = document.getElementById("account-info");

let currentUser = null;
let currentGames = [];

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

    currentUser = user;

    // Load profile
    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select(`
            username,
            display_name,
            is_admin,
            is_suspended,
            suspended_until
        `)
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        gamesList.innerHTML =
            "<p>Could not load your profile.</p>";
        return;
    }

    // Check suspension
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

        quickActions.innerHTML = "";
        accountInfo.innerHTML = `
            <p>
                <strong>Username:</strong>
                ${escapeHTML(profile.username)}
            </p>

            <p>
                <strong>Status:</strong>
                SUSPENDED
            </p>
        `;

        return;
    }

    // Welcome message
    welcomeTitle.textContent =
        `Welcome, ${profile.display_name || profile.username}.`;

    // Account information
    accountInfo.innerHTML = `
        <p>
            <strong>Username:</strong>
            ${escapeHTML(profile.username)}
        </p>

        <p>
            <strong>Display name:</strong>
            ${escapeHTML(
                profile.display_name || profile.username
            )}
        </p>

        <p>
            <strong>Status:</strong>
            ACTIVE
        </p>
    `;

    // Load games
    const {
        data: games,
        error: gamesError
    } = await supabaseClient
        .from("games")
        .select(`
            id,
            name,
            slug,
            description,
            created_at
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

    if (gamesError) {
        console.error(gamesError);

        gamesList.innerHTML =
            "<p>Could not load your games.</p>";

        return;
    }

    currentGames = games || [];

    // No games
    if (currentGames.length === 0) {

        gamesList.innerHTML = `
            <div class="build-card">

                <h2>No games yet</h2>

                <p>
                    You haven't added a game yet.
                </p>

                <button
                    class="btn primary"
                    onclick="window.location.href='add-game.html'"
                >
                    Add your first game
                </button>

            </div>
        `;

        quickActions.innerHTML = `
            <div class="build-card">
                <h2>Quick actions</h2>

                <p>
                    Add a game first before creating builds.
                </p>
            </div>
        `;

        return;
    }

    // Load builds
    const gameIds = currentGames.map(game => game.id);

    const {
        data: builds,
        error: buildsError
    } = await supabaseClient
        .from("builds")
        .select(`
            id,
            game_id,
            version,
            build_date,
            status
        `)
        .in("game_id", gameIds);

    if (buildsError) {
        console.error(buildsError);

        gamesList.innerHTML =
            "<p>Could not load your builds.</p>";

        return;
    }

    renderGames(currentGames, builds || []);
    renderQuickActions(currentGames);
}

function renderGames(games, builds) {

    gamesList.innerHTML = games.map(game => {

        const gameBuilds = builds.filter(
            build => build.game_id === game.id
        );

        const sortedBuilds = [...gameBuilds].sort(
            (a, b) =>
                new Date(b.build_date) -
                new Date(a.build_date)
        );

        const latestBuild = sortedBuilds[0];

        return `
            <article class="build-card">

                <span class="eyebrow">
                    GAME
                </span>

                <h2>
                    ${escapeHTML(game.name)}
                </h2>

                <p>
                    ${escapeHTML(
                        game.description ||
                        "No description."
                    )}
                </p>

                <div class="game-card-info">

                    <div>
                        <span>BUILDS</span>
                        <strong>
                            ${gameBuilds.length}
                        </strong>
                    </div>

                    <div>
                        <span>LATEST</span>
                        <strong>
                            ${
                                latestBuild
                                    ? escapeHTML(
                                        latestBuild.version
                                    )
                                    : "—"
                            }
                        </strong>
                    </div>

                </div>

                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:20px;">

                    <a
                        href="game.html?slug=${encodeURIComponent(game.slug)}"
                        class="btn primary"
                    >
                        View game
                    </a>

                    <a
                        href="manage-game.html?id=${encodeURIComponent(game.id)}"
                        class="btn"
                    >
                        Manage game
                    </a>

                </div>

            </article>
        `;
    }).join("");
}

function renderQuickActions(games) {

    const firstGame = games[0];

    quickActions.innerHTML = `
        <div class="build-card">

            <h2>Add a build</h2>

            <p>
                Upload a new build to one of your games.
            </p>

            <a
                href="manage-game.html?id=${encodeURIComponent(firstGame.id)}&action=add-build"
                class="btn primary"
            >
                + Add build
            </a>

        </div>
    `;
}

logoutButton.addEventListener("click", async () => {

    await supabaseClient.auth.signOut();

    window.location.href = "login.html";
});

addGameButton.addEventListener("click", () => {
    window.location.href = "add-game.html";
});

function escapeHTML(value) {

    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadDashboard();
