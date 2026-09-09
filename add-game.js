const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const form = document.getElementById("add-game-form");
const gameNameInput = document.getElementById("game-name");
const gameSlugInput = document.getElementById("game-slug");
const gameDescriptionInput =
    document.getElementById("game-description");

const createGameButton =
    document.getElementById("create-game-button");

const logoutButton =
    document.getElementById("logout-button");

const formMessage =
    document.getElementById("form-message");

let slugWasManuallyChanged = false;


/*
|--------------------------------------------------------------------------
| Check login
|--------------------------------------------------------------------------
*/

async function checkLogin() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = "login.html";
        return null;
    }

    return user;
}


/*
|--------------------------------------------------------------------------
| Create slug from game name
|--------------------------------------------------------------------------
*/

function createSlug(value) {

    return value
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100);
}


/*
|--------------------------------------------------------------------------
| Automatically update slug
|--------------------------------------------------------------------------
*/

gameNameInput.addEventListener("input", () => {

    if (!slugWasManuallyChanged) {
        gameSlugInput.value =
            createSlug(gameNameInput.value);
    }

});


gameSlugInput.addEventListener("input", () => {

    slugWasManuallyChanged = true;

    gameSlugInput.value = createSlug(
        gameSlugInput.value
    );

});


/*
|--------------------------------------------------------------------------
| Show message
|--------------------------------------------------------------------------
*/

function showMessage(message, type = "error") {

    if (type === "success") {

        formMessage.innerHTML = `
            <p style="color:#00e5a0;">
                ${escapeHTML(message)}
            </p>
        `;

        return;
    }

    formMessage.innerHTML = `
        <p style="color:#ff6b81;">
            ${escapeHTML(message)}
        </p>
    `;
}


/*
|--------------------------------------------------------------------------
| Create game
|--------------------------------------------------------------------------
*/

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    formMessage.innerHTML = "";

    const user = await checkLogin();

    if (!user) {
        return;
    }

    const name = gameNameInput.value.trim();
    const slug = createSlug(gameSlugInput.value);
    const description =
        gameDescriptionInput.value.trim();

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */

    if (!name) {
        showMessage("Please enter a game name.");
        return;
    }

    if (!slug) {
        showMessage("Please enter a valid game slug.");
        return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        showMessage(
            "The slug may only contain letters, numbers and hyphens."
        );
        return;
    }

    /*
    |--------------------------------------------------------------------------
    | Disable button
    |--------------------------------------------------------------------------
    */

    createGameButton.disabled = true;
    createGameButton.textContent = "Creating...";


    try {

        /*
        |--------------------------------------------------------------------------
        | Check whether slug already exists
        |--------------------------------------------------------------------------
        */

        const {
            data: existingGame,
            error: slugError
        } = await supabaseClient
            .from("games")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();

        if (slugError) {
            throw slugError;
        }

        if (existingGame) {

            showMessage(
                "A game with this slug already exists."
            );

            createGameButton.disabled = false;
            createGameButton.textContent = "Create game";

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | Insert game
        |--------------------------------------------------------------------------
        */

        const {
            data: newGame,
            error: insertError
        } = await supabaseClient
            .from("games")
            .insert({
                owner_id: user.id,
                name: name,
                slug: slug,
                description: description || null
            })
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }


        /*
        |--------------------------------------------------------------------------
        | Success
        |--------------------------------------------------------------------------
        */

        showMessage(
            `${name} was created successfully!`,
            "success"
        );

        createGameButton.textContent = "Created!";


        /*
        |--------------------------------------------------------------------------
        | Go back to dashboard
        |--------------------------------------------------------------------------
        */

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 800);

    } catch (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Could not create the game."
        );

        createGameButton.disabled = false;
        createGameButton.textContent = "Create game";
    }

});


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

logoutButton.addEventListener("click", async () => {

    await supabaseClient.auth.signOut();

    window.location.href = "login.html";
});


/*
|--------------------------------------------------------------------------
| Escape HTML
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

checkLogin();