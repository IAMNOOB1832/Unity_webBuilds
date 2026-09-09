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

    const { data, error } =
        await supabaseClient.functions.invoke("login-user", {
            body: {
                username: username,
                password: password
            }
        });

    if (error || !data?.access_token) {
        console.error(error, data);

        loginMessage.textContent =
            data?.error || "Username or password is incorrect.";

        return;
    }

    // Save the Supabase session returned by our Edge Function.
    const { error: sessionError } =
        await supabaseClient.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });

    if (sessionError) {
        console.error(sessionError);

        loginMessage.textContent =
            "Login succeeded, but the session could not be created.";

        return;
    }

    window.location.href = "dashboard.html";
});