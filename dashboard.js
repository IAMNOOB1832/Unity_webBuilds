const client = window.supabaseClient;

const gamesList = document.getElementById("games-list");
const quickActions = document.getElementById("quick-actions");
const accountInfo = document.getElementById("account-info");
const welcomeTitle = document.getElementById("welcome-title");

const logoutButton = document.getElementById("logout-button");
const addGameButton = document.getElementById("add-game-button");
const adminNavLink = document.getElementById("admin-nav-link");


async function loadDashboard() {
    try {
        const {
            data: {
                user
            },
            error: userError
        } = await client.auth.getUser();

        if (userError || !user) {
            window.location.href = "login.html";
            return;
        }


        const {
            data: profile,
            error: profileError
        } = await client
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                is_admin,
                is_suspended,
                suspended_until,
                created_at
            `)
            .eq("id", user.id)
            .single();


        if (profileError) {
            console.error("Profile error:", profileError);

            accountInfo.innerHTML = `
                <p>
                    Could not load your account.
                </p>
            `;

            return;
        }


        /*
         * ------------------------------------------------
         * ACCOUNT / SUSPENSION
         * ------------------------------------------------
         */

        const isSuspended = profile.is_suspended === true;

        if (isSuspended) {
            welcomeTitle.textContent = "Account suspended.";

            gamesList.innerHTML = `
                <div class="build-card">
                    <h3>
                        Your account is suspended.
                    </h3>

                    <p>
                        You currently cannot manage games or builds.
                    </p>
                </div>
            `;

            quickActions.innerHTML = `
                <div class="build-card">
                    <p>
                        Account actions are unavailable while your account is suspended.
                    </p>
                </div>
            `;

            accountInfo.innerHTML = `
                <h3>
                    ${escapeHTML(
                        profile.display_name ||
                        profile.username ||
                        "User"
                    )}
                </h3>

                <p>
                    Username:
                    <strong>
                        ${escapeHTML(profile.username)}
                    </strong>
                </p>

                <p>
                    Status:
                    <strong>
                        Suspended
                    </strong>
                </p>
            `;

            if (adminNavLink) {
                adminNavLink.style.display = "none";
            }

            if (addGameButton) {
                addGameButton.disabled = true;
            }

            return;
        }


        /*
         * ------------------------------------------------
         * WELCOME
         * ------------------------------------------------
         */

        const displayName =
            profile.display_name ||
            profile.username ||
            "User";

        welcomeTitle.textContent =
            `Welcome, ${displayName}.`;


        /*
         * ------------------------------------------------
         * ADMIN NAVIGATION
         * ------------------------------------------------
         */

        if (adminNavLink) {
            if (profile.is_admin === true) {
                adminNavLink.style.display = "inline-block";
            } else {
                adminNavLink.style.display = "none";
            }
        }


        /*
         * ------------------------------------------------
         * LOAD GAMES
         * ------------------------------------------------
         */

        const {
            data: games,
            error: gamesError
        } = await client
            .from("games")
            .select(`
                id,
                name,
                slug,
                description,
                created_at
            `)
            .eq("owner_id", user.id)
            .order("created_at", {
                ascending: false
            });


        if (gamesError) {
            console.error("Games error:", gamesError);

            gamesList.innerHTML = `
                <div class="build-card">
                    <p>
                        Could not load your games.
                    </p>
                </div>
            `;

            return;
        }


        /*
         * ------------------------------------------------
         * LOAD BUILDS
         * ------------------------------------------------
         */

        let builds = [];


        if (games && games.length > 0) {
            const gameIds = games.map(game => game.id);

            const {
                data: buildData,
                error: buildsError
            } = await client
                .from("builds")
                .select(`
                    id,
                    game_id,
                    version,
                    build_date,
                    status,
                    description,
                    url,
                    created_at
                `)
                .in("game_id", gameIds)
                .order("created_at", {
                    ascending: false
                });


            if (buildsError) {
                console.error("Builds error:", buildsError);
            } else {
                builds = buildData || [];
            }
        }


        /*
         * ------------------------------------------------
         * RENDER GAMES
         * ------------------------------------------------
         */

        renderGames(games || [], builds);


        /*
         * ------------------------------------------------
         * QUICK ACTIONS
         * ------------------------------------------------
         */

        renderQuickActions(games || []);


        /*
         * ------------------------------------------------
         * ACCOUNT
         * ------------------------------------------------
 */

        renderAccount(profile, games || [], builds);
    }

    catch (error) {
        console.error("Dashboard error:", error);

        gamesList.innerHTML = `
            <div class="build-card">
                <p>
                    Something went wrong while loading the dashboard.
                </p>
            </div>
        `;
    }
}


/*
 * ========================================================
 * RENDER GAMES
 * ========================================================
 */

function renderGames(games, builds) {
    if (!games || games.length === 0) {
        gamesList.innerHTML = `
            <div class="build-card">

                <h3>
                    No games yet.
                </h3>

                <p>
                    Create your first game to get started.
                </p>

                <br>

                <button
                    class="btn primary"
                    onclick="window.location.href='add-game.html'"
                >
                    Add game
                </button>

            </div>
        `;

        return;
    }


    gamesList.innerHTML = games.map(game => {

        const gameBuilds = builds.filter(
            build => build.game_id === game.id
        );


        const latestBuild =
            gameBuilds.length > 0
                ? gameBuilds[0]
                : null;


        return `
            <div class="build-card">

                <span class="eyebrow">
                    GAME
                </span>

                <h3>
                    ${escapeHTML(game.name)}
                </h3>

                <p>
                    ${escapeHTML(
                        game.description ||
                        "No description available."
                    )}
                </p>

                <p>
                    <strong>
                        Slug:
                    </strong>
                    ${escapeHTML(game.slug)}
                </p>

                <p>
                    <strong>
                        Builds:
                    </strong>
                    ${gameBuilds.length}
                </p>

                ${
                    latestBuild
                        ? `
                            <p>
                                <strong>
                                    Latest:
                                </strong>
                                ${escapeHTML(latestBuild.version)}
                            </p>
                        `
                        : `
                            <p>
                                <strong>
                                    Latest:
                                </strong>
                                No builds yet
                            </p>
                        `
                }

                <div class="hero-actions">

                    <a
                        href="game.html?slug=${encodeURIComponent(game.slug)}"
                        class="btn secondary"
                    >
                        View game
                    </a>

                    <a
                        href="manage-game.html?slug=${encodeURIComponent(game.slug)}"
                        class="btn primary"
                    >
                        Manage game
                    </a>

                </div>

            </div>
        `;
    }).join("");
}


/*
 * ========================================================
 * QUICK ACTIONS
 * ========================================================
 */

function renderQuickActions(games) {

    if (!quickActions) {
        return;
    }


    let html = `
        <div class="build-card">

            <h3>
                Add a game
            </h3>

            <p>
                Create a new game project.
            </p>

            <br>

            <a
                href="add-game.html"
                class="btn primary"
            >
                Add game
            </a>

        </div>
    `;


    if (games.length > 0) {
        const firstGame = games[0];

        html += `
            <div class="build-card">

                <h3>
                    Add a build
                </h3>

                <p>
                    Upload a new build for
                    ${escapeHTML(firstGame.name)}.
                </p>

                <br>

                <a
                    href="manage-game.html?slug=${encodeURIComponent(firstGame.slug)}"
                    class="btn primary"
                >
                    Manage game
                </a>

            </div>
        `;
    }


    quickActions.innerHTML = html;
}


/*
 * ========================================================
 * ACCOUNT
 * ========================================================
 */

function renderAccount(profile, games, builds) {

    if (!accountInfo) {
        return;
    }


    const status =
        profile.is_suspended === true
            ? "Suspended"
            : "Active";


    const adminStatus =
        profile.is_admin === true
            ? "Administrator"
            : "User";


    accountInfo.innerHTML = `

        <h3>
            ${escapeHTML(
                profile.display_name ||
                profile.username ||
                "User"
            )}
        </h3>

        <p>
            <strong>
                Username:
            </strong>

            ${escapeHTML(profile.username)}
        </p>

        <p>
            <strong>
                Account type:
            </strong>

            ${adminStatus}
        </p>

        <p>
            <strong>
                Status:
            </strong>

            ${status}
        </p>

        <p>
            <strong>
                Games:
            </strong>

            ${games.length}
        </p>

        <p>
            <strong>
                Builds:
            </strong>

            ${builds.length}
        </p>

    `;
}


/*
 * ========================================================
 * LOGOUT
 * ========================================================
 */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            const {
                error
            } = await client.auth.signOut();


            if (error) {
                console.error(
                    "Logout error:",
                    error
                );

                return;
            }


            window.location.href = "login.html";
        }
    );
}


/*
 * ========================================================
 * ADD GAME BUTTON
 * ========================================================
 */

if (addGameButton) {

    addGameButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "add-game.html";

        }
    );
}


/*
 * ========================================================
 * HTML ESCAPE
 * ========================================================
 */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/*
 * ========================================================
 * START DASHBOARD
 * ========================================================
 */

loadDashboard();