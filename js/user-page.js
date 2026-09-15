(function () {
    async function getCurrentUser() {
        if (!window.HomeStockOnline?.enabled) return null;
        return await window.HomeStockOnline.session();
    }

    function initials(name) {
        return (name || "HomeStock User")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[char]));
    }

    async function loadProfilePage() {
        const online = window.HomeStockOnline?.enabled;
        const account = document.querySelector("#profileAccount");
        const members = document.querySelector("#recentUsers");
        if (!account || !members) return;

        if (!online) {
            account.innerHTML = '<div class="empty-state"><h3>Online account required</h3><p>Connect HomeStock to Supabase to manage family accounts.</p></div>';
            members.innerHTML = "";
            return;
        }

        try {
            const user = await getCurrentUser();
            if (!user) return;
            const profile = await window.HomeStockOnline.getProfile(user.id);

            const name = profile?.full_name || user.email?.split("@")[0] || "HomeStock User";
            const role = profile?.role || "member";
            const household = profile?.household_id || "—";

            document.querySelectorAll("[data-profile-name]").forEach(el => el.textContent = name);
            document.querySelectorAll("[data-profile-email]").forEach(el => el.textContent = user.email || "");
            document.querySelectorAll("[data-profile-initials]").forEach(el => el.textContent = initials(name));
            document.querySelector("#profileRole").textContent = role === "admin" ? "Administrator" : "Family member";
            document.querySelector("#profileHousehold").textContent = household === "—" ? household : household.slice(0, 8).toUpperCase();
            document.querySelector("#profileJoined").textContent = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

            account.innerHTML = `
                <div class="profile-hero">
                    <div class="profile-avatar-large">${escapeHtml(initials(name))}</div>
                    <div>
                        <span class="eyebrow">SIGNED IN AS</span>
                        <h2>${escapeHtml(name)}</h2>
                        <p>${escapeHtml(user.email || "")}</p>
                    </div>
                    <span class="role-pill">${role === "admin" ? "Administrator" : "Family member"}</span>
                </div>`;

            const profiles = await window.HomeStockOnline.request("profiles?household_id=eq." + encodeURIComponent(profile.household_id) + "&select=id,full_name,role,created_at&order=created_at.desc&limit=12");
            members.innerHTML = profiles.length ? profiles.map(member => `
                <div class="user-row">
                    <div class="mini-avatar">${escapeHtml(initials(member.full_name))}</div>
                    <div class="user-row-main">
                        <strong>${escapeHtml(member.full_name)}</strong>
                        <span>${member.role === "admin" ? "Administrator" : "Family member"}</span>
                    </div>
                    <time>${member.created_at ? new Date(member.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</time>
                </div>`).join("") : '<div class="empty-state"><h3>No family members yet</h3><p>You are the first member of this HomeStock household.</p></div>';
        } catch (error) {
            account.innerHTML = '<div class="empty-state"><h3>Unable to load account</h3><p>Please check your Supabase connection and try again.</p></div>';
            members.innerHTML = "";
            console.error(error);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadProfilePage();
        const logoutButton = document.querySelector("#profilePageLogout");
        logoutButton?.addEventListener("click", async () => {
            try {
                if (window.HomeStockOnline?.enabled) await window.HomeStockOnline.signOut();
                else {
                    localStorage.removeItem("homestock-login");
                    localStorage.removeItem("homestock-current-user");
                }
            } finally {
                location.href = "login.html";
            }
        });
    });
})();
