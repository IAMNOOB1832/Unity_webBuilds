const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


const usersList =
    document.getElementById("users-list");

const adminMessage =
    document.getElementById("admin-message");

const createUserButton =
    document.getElementById("create-user-button");

const createUserSection =
    document.getElementById("create-user-section");

const createUserForm =
    document.getElementById("create-user-form");

const cancelCreateUser =
    document.getElementById("cancel-create-user");

const createUserMessage =
    document.getElementById("create-user-message");

const submitCreateUser =
    document.getElementById("submit-create-user");

const logoutButton =
    document.getElementById("logout-button");

const recentUploads =
    document.getElementById("recent-uploads");


let currentProfile = null;

let users = [];


/* =========================================
   LOAD ADMIN PAGE
========================================= */

async function loadAdminPage() {

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();


    if (userError || !user) {

        window.location.href =
            "login.html";

        return;
    }


    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select(`
            id,
            username,
            display_name,
            is_admin,
            is_suspended,
            suspended_until
        `)
        .eq("id", user.id)
        .single();


    if (profileError || !profile) {

        showAdminMessage(
            "Could not load your profile."
        );

        return;
    }


    currentProfile =
        profile;


    if (
        profile.is_admin !== true
    ) {

        document.querySelector("main").innerHTML = `

            <section class="hero">

                <div class="hero-content">

                    <span class="eyebrow">
                        ACCESS DENIED
                    </span>

                    <h1>
                        No access.
                    </h1>

                    <p>
                        You do not have permission to access
                        the admin area.
                    </p>

                    <a
                        href="dashboard.html"
                        class="btn primary"
                    >
                        Back to dashboard
                    </a>

                </div>

            </section>

        `;

        return;
    }


    if (
        profile.is_suspended === true
    ) {

        document.querySelector("main").innerHTML = `

            <section class="hero">

                <div class="hero-content">

                    <span class="eyebrow">
                        ACCOUNT SUSPENDED
                    </span>

                    <h1>
                        Access blocked.
                    </h1>

                    <p>
                        Your admin account is currently suspended.
                    </p>

                    <button
                        id="suspended-logout"
                        class="btn primary"
                    >
                        Log out
                    </button>

                </div>

            </section>

        `;


        document
            .getElementById(
                "suspended-logout"
            )
            .addEventListener(
                "click",
                async () => {

                    await supabaseClient
                        .auth
                        .signOut();

                    window.location.href =
                        "login.html";
                }
            );

        return;
    }


    await loadDashboardData();
}


/* =========================================
   LOAD DASHBOARD DATA
========================================= */

async function loadDashboardData() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .functions
            .invoke(
                "admin-dashboard"
            );


        if (error) {
            throw error;
        }


        if (!data?.success) {

            throw new Error(
                data?.error ||
                "Could not load admin dashboard."
            );
        }


        /*
         * Statistics.
         */

        renderStats(
            data.stats
        );


        /*
         * Users.
         */

        users =
            data.users || [];

        renderUsers(
            users
        );


        /*
         * Recent uploads.
         */

        renderRecentUploads(
            data.recentUploads || []
        );


    } catch (error) {

        console.error(error);

        showAdminMessage(
            error.message ||
            "Could not load admin dashboard."
        );
    }
}


/* =========================================
   STATISTICS
========================================= */

function renderStats(stats) {

    document.getElementById(
        "stat-users"
    ).textContent =
        stats?.users ?? 0;


    document.getElementById(
        "stat-games"
    ).textContent =
        stats?.games ?? 0;


    document.getElementById(
        "stat-builds"
    ).textContent =
        stats?.builds ?? 0;


    document.getElementById(
        "stat-uploads"
    ).textContent =
        stats?.uploads_this_week ?? 0;


    document.getElementById(
        "stat-suspended"
    ).textContent =
        stats?.suspended_users ?? 0;
}


/* =========================================
   RECENT UPLOADS
========================================= */

function renderRecentUploads(
    uploads
) {

    if (!uploads.length) {

        recentUploads.innerHTML = `

            <div class="build-card">

                <h2>
                    No uploads yet
                </h2>

                <p>
                    No builds have been uploaded this week.
                </p>

            </div>

        `;

        return;
    }


    recentUploads.innerHTML =
        uploads.map(upload => {

            const date =
                upload.created_at
                    ? new Date(
                        upload.created_at
                    ).toLocaleString()
                    : "—";


            return `

                <article class="build-card">

                    <span class="eyebrow">
                        BUILD UPLOAD
                    </span>

                    <h2>
                        ${escapeHTML(
                            upload.game_name
                        )}
                    </h2>

                    <p>
                        ${escapeHTML(
                            upload.version
                        )}
                    </p>


                    <div class="game-card-info">

                        <div>

                            <span>
                                USER
                            </span>

                            <strong>
                                ${escapeHTML(
                                    upload.display_name
                                )}
                            </strong>

                        </div>


                        <div>

                            <span>
                                UPLOADED
                            </span>

                            <strong>
                                ${escapeHTML(
                                    date
                                )}
                            </strong>

                        </div>

                    </div>

                </article>

            `;

        }).join("");
}


/* =========================================
   USERS
========================================= */

function renderUsers(
    users
) {

    if (!users.length) {

        usersList.innerHTML = `

            <div class="build-card">

                <h2>
                    No users
                </h2>

                <p>
                    There are no users yet.
                </p>

            </div>

        `;

        return;
    }


    /*
     * Admin first.
     *
     * Then alphabetical by name.
     */

    const sortedUsers =
        [...users].sort(
            (a, b) => {

                const adminA =
                    a.is_admin === true;

                const adminB =
                    b.is_admin === true;


                if (
                    adminA &&
                    !adminB
                ) {
                    return -1;
                }


                if (
                    !adminA &&
                    adminB
                ) {
                    return 1;
                }


                const nameA =
                    (
                        a.display_name ||
                        a.username ||
                        ""
                    ).toLowerCase();


                const nameB =
                    (
                        b.display_name ||
                        b.username ||
                        ""
                    ).toLowerCase();


                return nameA.localeCompare(
                    nameB
                );
            }
        );


    usersList.innerHTML =
        sortedUsers
            .map(user => {

                const status =
                    user.is_suspended
                        ? "SUSPENDED"
                        : "ACTIVE";


                const role =
                    user.is_admin
                        ? "ADMIN"
                        : "USER";


                const created =
                    user.created_at
                        ? new Date(
                            user.created_at
                        ).toLocaleDateString()
                        : "—";


                const isCurrentUser =
                    user.id ===
                    currentProfile.id;


                return `

                    <article class="build-card">

                        <span class="eyebrow">
                            ${role}
                        </span>


                        <h2>
                            ${escapeHTML(
                                user.display_name ||
                                user.username
                            )}
                        </h2>


                        <p>
                            @${escapeHTML(
                                user.username
                            )}
                        </p>


                        <div class="game-card-info">

                            <div>

                                <span>
                                    STATUS
                                </span>

                                <strong>
                                    ${status}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    CREATED
                                </span>

                                <strong>
                                    ${created}
                                </strong>

                            </div>

                        </div>


                        ${
                            user.suspended_until
                                ? `

                                    <p
                                        style="
                                            margin-top:15px;
                                        "
                                    >
                                        Suspended until:
                                        ${escapeHTML(
                                            new Date(
                                                user.suspended_until
                                            ).toLocaleString()
                                        )}
                                    </p>

                                `
                                : ""
                        }


                        <div
                            style="
                                display:flex;
                                gap:10px;
                                flex-wrap:wrap;
                                margin-top:20px;
                            "
                        >

                            ${
                                user.is_suspended
                                    ? `

                                        <button
                                            class="btn primary"
                                            onclick="reactivateUser('${user.id}')"
                                        >
                                            Reactivate
                                        </button>

                                    `
                                    : user.is_admin
                                        ? ""
                                        : `

                                            <button
                                                class="btn"
                                                onclick="suspendUser('${user.id}')"
                                            >
                                                Suspend
                                            </button>

                                        `
                            }

                            ${
                                !user.is_admin && !isCurrentUser
                                    ? `
                                        <button
                                            class="btn"
                                            style="background-color: #ff6b81; color: white;"
                                            onclick="deleteUser('${user.id}')"
                                        >
                                            Delete
                                        </button>
                                    `
                                    : ""
                            }


                            ${
                                isCurrentUser
                                    ? `

                                        <span
                                            style="
                                                align-self:center;
                                                opacity:0.7;
                                            "
                                        >
                                            This is you
                                        </span>

                                    `
                                    : ""
                            }

                        </div>

                    </article>

                `;

            })
            .join("");
}


/* =========================================
   CREATE USER
========================================= */

createUserButton.addEventListener(
    "click",
    () => {

        createUserSection.style.display =
            "block";


        createUserSection.scrollIntoView({
            behavior: "smooth"
        });
    }
);


cancelCreateUser.addEventListener(
    "click",
    () => {

        createUserForm.reset();

        createUserMessage.innerHTML =
            "";

        createUserSection.style.display =
            "none";
    }
);


createUserForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        createUserMessage.innerHTML =
            "";


        const username =
            document
                .getElementById(
                    "new-username"
                )
                .value
                .trim()
                .toLowerCase();


        const displayName =
            document
                .getElementById(
                    "new-display-name"
                )
                .value
                .trim();


        const password =
            document
                .getElementById(
                    "new-password"
                )
                .value;


        if (
            !/^[a-z0-9_]+$/.test(
                username
            )
        ) {

            showCreateUserMessage(
                "Username may only contain lowercase letters, numbers and underscores."
            );

            return;
        }


        if (
            password.length < 8
        ) {

            showCreateUserMessage(
                "Password must be at least 8 characters."
            );

            return;
        }


        submitCreateUser.disabled =
            true;

        submitCreateUser.textContent =
            "Creating...";


        try {

            const {
                data,
                error
            } = await supabaseClient
                .functions
                .invoke(
                    "create-user",
                    {
                        body: {
                            username,
                            display_name:
                                displayName,
                            password
                        }
                    }
                );


            if (error) {
                throw error;
            }


            if (!data?.success) {

                throw new Error(
                    data?.error ||
                    "Could not create user."
                );
            }


            showCreateUserMessage(
                "User created successfully.",
                "success"
            );


            createUserForm.reset();


            await loadDashboardData();


            setTimeout(
                () => {

                    createUserSection.style.display =
                        "none";

                    createUserMessage.innerHTML =
                        "";

                },
                800
            );


        } catch (error) {

            console.error(error);


            showCreateUserMessage(
                error.message ||
                "Could not create user."
            );


        } finally {

            submitCreateUser.disabled =
                false;

            submitCreateUser.textContent =
                "Create user";
        }
    }
);


/* =========================================
   SUSPEND
========================================= */

async function suspendUser(
    userId
) {

    if (
        userId ===
        currentProfile.id
    ) {

        alert(
            "You cannot suspend your own account."
        );

        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to suspend this user?"
        );


    if (!confirmed) {
        return;
    }


    await manageUser(
        userId,
        "suspend"
    );
}


/* =========================================
   REACTIVATE
========================================= */

async function reactivateUser(
    userId
) {

    await manageUser(
        userId,
        "reactivate"
    );
}


/* =========================================
   MANAGE USER
========================================= */

async function manageUser(
    userId,
    action
) {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .functions
            .invoke(
                "admin-manage-user",
                {
                    body: {
                        userId,
                        action
                    }
                }
            );


        if (error) {
            throw error;
        }


        if (!data?.success) {

            throw new Error(
                data?.error ||
                "Could not update user."
            );
        }


        showAdminMessage(
            action === "suspend"
                ? "User suspended."
                : "User reactivated.",
            "success"
        );


        await loadDashboardData();


    } catch (error) {

        console.error(error);


        showAdminMessage(
            error.message ||
            "Could not update user."
        );
    }
}


/* =========================================
   DELETE USER
========================================= */

async function deleteUser(userId) {

    if (userId === currentProfile.id) {
        alert("You cannot delete your own account.");
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete this user? This cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .functions
            .invoke(
                "admin-delete-user",
                {
                    body: { userId }
                }
            );

        if (error) {
            throw error;
        }

        if (!data?.success) {
            throw new Error(
                data?.error ||
                "Could not delete user."
            );
        }

        showAdminMessage(
            "User successfully deleted.",
            "success"
        );

        await loadDashboardData();

    } catch (error) {

        console.error(error);

        showAdminMessage(
            error.message ||
            "Could not delete user."
        );
    }
}


/* =========================================
   MESSAGES
========================================= */

function showAdminMessage(
    message,
    type = "error"
) {

    if (
        type === "success"
    ) {

        adminMessage.innerHTML = `

            <p style="color:#00e5a0;">
                ${escapeHTML(message)}
            </p>

        `;

        return;
    }


    adminMessage.innerHTML = `

        <p style="color:#ff6b81;">
            ${escapeHTML(message)}
        </p>

    `;
}


function showCreateUserMessage(
    message,
    type = "error"
) {

    if (
        type === "success"
    ) {

        createUserMessage.innerHTML = `

            <p style="color:#00e5a0;">
                ${escapeHTML(message)}
            </p>

        `;

        return;
    }


    createUserMessage.innerHTML = `

        <p style="color:#ff6b81;">
            ${escapeHTML(message)}
        </p>

    `;
}


/* =========================================
   LOGOUT
========================================= */

logoutButton.addEventListener(
    "click",
    async () => {

        await supabaseClient
            .auth
            .signOut();

        window.location.href =
            "login.html";
    }
);


/* =========================================
   SECURITY
========================================= */

function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }


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


/* =========================================
   START
========================================= */

loadAdminPage();