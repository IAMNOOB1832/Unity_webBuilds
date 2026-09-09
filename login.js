const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document
        .getElementById("username")
        .value
        .trim()
        .toLowerCase();

    const password = document.getElementById("password").value;

    loginMessage.textContent = "Logging in...";

    const internalEmail =
        `${username}@accounts.gamebuild.local`;

    const { error } =
        await supabaseClient.auth.signInWithPassword({
            email: internalEmail,
            password: password
        });

    if (error) {
        loginMessage.textContent =
            "Username or password is incorrect.";
        return;
    }

    window.location.href = "dashboard.html";
});
