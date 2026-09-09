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

let currentProfile = null;
let users = [];

async function loadAdminPage() {

    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "login.html";
        return;
    }

    /*
     * Load current user's profile.
     */
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

    currentProfile = profile;

    /*
     * Only admins may use this page.
     */
    if (profile.is_admin !== true) {

        document.querySelector("main").innerHTML = `
            <section class="hero">
                <div class="hero-content">

                    <span class="eyebrow">
                        ACCESS DENIED
                    </span>

                    <h1>No access.</h1>

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

    await loadUsers();
}

async function loadUsers() {

    usersList.innerHTML =
        "<p>Loading users...</p>";

    const {
        data,
        error
    } = await supabaseClient
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
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(error);

        usersList.innerHTML =
            "<p>Could not load users.</p>";

        return;
    }

    users = data || [];

    renderUsers(users);
}

function renderUsers(users) {

    if (users.length === 0) {

        usersList.innerHTML = `
            <div class="build-card">
                <h2>No users</h2>
                <p>
                    There are no users yet.
                </p>
            </div>
        `;

        return;
    }

    usersList.innerHTML =
        users.map(user => {

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
                user.id === currentProfile.id;

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
                            <span>STATUS</span>

                            <strong>
                                ${status}
                            </strong>
                        </div>

                        <div>
                            <span>CREATED</span>

                            <strong>
                                ${created}
                            </strong>
                        </div>

                    </div>

                    ${
                        user.suspended_until
                            ? `
                                <p style="margin-top:15px;">
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

        }).join("");
}

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

        createUserMessage.innerHTML = "";

        createUserSection.style.display =
            "none";

    }
);

createUserForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        createUserMessage.innerHTML = "";

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

        if (!/^[a-z0-9_]+$/.test(username)) {

            showCreateUserMessage(
                "Username may only contain lowercase letters, numbers and underscores."
            );

            return;
        }

        if (password.length < 8) {

            showCreateUserMessage(
                "Password must be at least 8 characters."
            );

            return;
        }

        submitCreateUser.disabled = true;
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

            await loadUsers();

            setTimeout(() => {

                createUserSection.style.display =
                    "none";

                createUserMessage.innerHTML = "";

            }, 800);

        } catch (error) {

            console.error(error);

            showCreateUserMessage(
                error.message ||
                "Could not create user."
            );

        } finally {

            submitCreateUser.disabled = false;

            submitCreateUser.textContent =
                "Create user";
        }

    }
);

async function suspendUser(userId) {

    if (userId === currentProfile.id) {

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

    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({
            is_suspended: true,
            suspended_until: null
        })
        .eq("id", userId);

    if (error) {

        console.error(error);

        showAdminMessage(
            "Could not suspend user."
        );

        return;
    }

    showAdminMessage(
        "User suspended.",
        "success"
    );

    await loadUsers();
}

async function reactivateUser(userId) {

    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({
            is_suspended: false,
            suspended_until: null
        })
        .eq("id", userId);

    if (error) {

        console.error(error);

        showAdminMessage(
            "Could not reactivate user."
        );

        return;
    }

    showAdminMessage(
        "User reactivated.",
        "success"
    );

    await loadUsers();
}

function showAdminMessage(
    message,
    type = "error"
) {

    if (type === "success") {

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

    if (type === "success") {

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

logoutButton.addEventListener(
    "click",
    async () => {

        await supabaseClient.auth.signOut();

        window.location.href =
            "login.html";

    }
);

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
        .replaceAll(
            "'",
            "&#039;"
        );
}

loadAdminPage();