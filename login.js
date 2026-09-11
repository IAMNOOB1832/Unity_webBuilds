const client = window.supabaseClient;

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginMessage = document.getElementById("login-message");


/*
 * ========================================================
 * LOGIN
 * ========================================================
 */

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    loginMessage.textContent = "";
    loginMessage.style.color = "";


    const username = usernameInput.value.trim();
    const password = passwordInput.value;


    if (!username || !password) {

        loginMessage.textContent =
            "Please enter your username and password.";

        return;
    }


    try {

        loginMessage.textContent =
            "Logging in...";


        const response = await fetch(
            "https://rfbsjpghlhcxqesvftta.supabase.co/functions/v1/login-user",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "apikey": window.SUPABASE_KEY
                },

                body: JSON.stringify({
                    username: username,
                    password: password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            console.error("Login error:", data);

            loginMessage.textContent =
                data.error ||
                "Login failed.";

            return;
        }


        if (
            !data.access_token ||
            !data.refresh_token
        ) {

            console.error(
                "Login response missing tokens:",
                data
            );

            loginMessage.textContent =
                "Login failed: invalid server response.";

            return;
        }


        /*
         * Save the Supabase session.
         */

        const {
            error: sessionError
        } = await client.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });


        if (sessionError) {

            console.error(
                "Session error:",
                sessionError
            );

            loginMessage.textContent =
                "Login failed while creating your session.";

            return;
        }


        /*
         * Login successful.
         */

        loginMessage.textContent =
            "Login successful!";


        /*
         * Small delay so the user can see
         * the success message.
         */

        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 300);


    } catch (error) {

        console.error(
            "Unexpected login error:",
            error
        );

        loginMessage.textContent =
            "Something went wrong. Please try again.";
    }

});