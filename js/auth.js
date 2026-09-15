(function () {
    const ACCOUNT_KEY = "homestock-account";
    const LOGIN_KEY = "homestock-logged-in";
    const online = () => window.HomeStockOnline && window.HomeStockOnline.enabled;

    function getAccount() {
        try { return JSON.parse(localStorage.getItem("homestock-current-user") || localStorage.getItem(ACCOUNT_KEY)); }
        catch { return null; }
    }

    function isLoggedIn() {
        return online()
            ? !!localStorage.getItem("homestock-access-token")
            : localStorage.getItem(LOGIN_KEY) === "true";
    }

    function protectPages() {
        const page = location.pathname.split("/").pop().toLowerCase();
        const publicPages = ["login.html", "register.html", ""];
        if (!publicPages.includes(page) && !isLoggedIn()) location.href = "login.html";
    }

    function setupLogin() {
        const success = document.querySelector("#authSuccess");
        const registrationMessage = localStorage.getItem("homestock-registration-success");
        if (success && registrationMessage) {
            success.textContent = registrationMessage;
            success.hidden = false;
            localStorage.removeItem("homestock-registration-success");
        }
        const form = document.querySelector("#loginForm");
        if (!form) return;
        if (isLoggedIn()) { location.href = "index.html"; return; }
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.querySelector("#email").value.trim().toLowerCase();
            const password = document.querySelector("#password").value;
            const error = document.querySelector("#authError");
            try {
                if (online()) {
                    await window.HomeStockOnline.signIn(email, password);
                    await window.HomeStockOnline.pull();
                } else {
                    const account = getAccount();
                    if (!account || email !== account.email || password !== account.password) throw new Error("Incorrect email or password.");
                    localStorage.setItem(LOGIN_KEY, "true");
                }
                location.href = "index.html";
            } catch (err) {
                error.textContent = err.message || "Unable to sign in.";
                error.hidden = false;
            }
        });
    }

    function setupRegister() {
        const form = document.querySelector("#registerForm");
        if (!form) return;
        if (isLoggedIn()) { location.href = "index.html"; return; }
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const name = document.querySelector("#name").value.trim();
            const email = document.querySelector("#email").value.trim().toLowerCase();
            const password = document.querySelector("#password").value;
            const confirm = document.querySelector("#confirm_password").value;
            const error = document.querySelector("#authError");
            try {
                if (!name || !email || !password || !confirm) throw new Error("Please complete all fields.");
                if (password.length < 6) throw new Error("Password must be at least 6 characters.");
                if (password !== confirm) throw new Error("Passwords do not match.");
                if (online()) {
                    const result = await window.HomeStockOnline.signUp(name, email, password);
                    // Registration should always finish on the login page.
                    // If Supabase returned a session because email confirmation is disabled,
                    // sign it out immediately so the user explicitly logs in next.
                    if (result.access_token) {
                        await window.HomeStockOnline.signOut();
                    }
                    localStorage.setItem("homestock-registration-success", "Account created successfully. Please log in.");
                    location.href = "login.html";
                    return;
                } else {
                    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ name, email, password }));
                    localStorage.removeItem(LOGIN_KEY);
                    localStorage.setItem("homestock-registration-success", "Account created successfully. Please log in.");
                }
                location.href = "login.html";
            } catch (err) {
                error.textContent = err.message || "Unable to register.";
                error.hidden = false;
            }
        });
    }

    function setupUserDisplay() {
        const account = getAccount();
        if (!account) return;
        document.querySelectorAll("[data-user-name]").forEach((el) => el.textContent = account.name || "HomeStock User");
        document.querySelectorAll("[data-user-email]").forEach((el) => el.textContent = account.email || "");
        document.querySelectorAll("[data-user-initials]").forEach((el) => {
            el.textContent = (account.name || "HomeStock User").split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join("");
        });
    }

    function setupLogout() {
        document.querySelectorAll("[data-logout]").forEach((button) => {
            button.addEventListener("click", async () => {
                if (online()) await window.HomeStockOnline.signOut();
                else {
                    localStorage.removeItem(LOGIN_KEY);
                    localStorage.removeItem("homestock-current-user");
                }
                location.href = "login.html";
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        protectPages(); setupLogin(); setupRegister(); setupUserDisplay(); setupLogout();
    });
})();
