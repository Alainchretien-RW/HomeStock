(function () {
    const AVATARS = ["🙂", "😎", "🤩", "🥳", "🐼", "🦊", "🐸", "🐨", "🐯", "🐰", "🐱", "🦄", "🐻", "🐙", "🐵", "🐧"];
    const CURRENT_USER_KEY = "homestock-current-user";
    let activePopup = null;

    function readUser() {
        try {
            return JSON.parse(
                localStorage.getItem(CURRENT_USER_KEY) ||
                localStorage.getItem("homestock-account") ||
                "null"
            );
        } catch (_) { return null; }
    }

    function saveLocalUser(patch) {
        const current = readUser() || {};
        const updated = { ...current, ...patch };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        return updated;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[char]));
    }

    function refreshUserDisplay() {
        const user = readUser();
        if (!user) return;
        document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = user.name || "HomeStock User");
        document.querySelectorAll("[data-user-email]").forEach(el => el.textContent = user.email || "");
        document.querySelectorAll("[data-profile-avatar]").forEach(el => el.textContent = user.avatar || "🙂");
    }

    function closePopup() {
        activePopup?.remove();
        activePopup = null;
        document.querySelectorAll("[data-profile-toggle]").forEach(button => button.setAttribute("aria-expanded", "false"));
    }

    function makePopup() {
        const user = readUser() || {};
        const popup = document.createElement("div");
        popup.className = "profile-popup";
        popup.setAttribute("role", "dialog");
        popup.innerHTML = `
            <div class="profile-popup-top">
                <div class="profile-popup-avatar">${escapeHtml(user.avatar || "🙂")}</div>
                <div class="profile-popup-identity">
                    <strong>${escapeHtml(user.name || "HomeStock User")}</strong>
                    <span>${escapeHtml(user.email || "")}</span>
                </div>
            </div>
            <div class="profile-popup-divider"></div>
            <button type="button" class="profile-action" data-change-name>
                <span class="profile-action-icon">✎</span>
                <span><strong>Change name</strong><small>Update your HomeStock name</small></span>
                <span class="profile-action-arrow">›</span>
            </button>
            <button type="button" class="profile-action" data-change-avatar>
                <span class="profile-action-icon">🎨</span>
                <span><strong>Change profile picture</strong><small>Choose a cartoon avatar</small></span>
                <span class="profile-action-arrow">›</span>
            </button>
            <div class="profile-popup-divider"></div>
            <button type="button" class="profile-action profile-action-logout" data-popup-logout>
                <span class="profile-action-icon">↪</span>
                <span><strong>Log out</strong><small>Sign out of HomeStock</small></span>
            </button>`;
        return popup;
    }

    function positionPopup(popup, button) {
        const rect = button.getBoundingClientRect();
        const width = Math.min(340, window.innerWidth - 24);
        popup.style.position = "fixed";
        popup.style.width = `${width}px`;
        let left = rect.right - width;
        if (left < 12) left = 12;
        if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
        let top = rect.bottom + 10;
        const height = popup.offsetHeight;
        if (top + height > window.innerHeight - 12) top = rect.top - height - 10;
        popup.style.left = `${left}px`;
        popup.style.top = `${Math.max(12, top)}px`;
    }

    function showPopup(button) {
        closePopup();
        const popup = makePopup();
        document.body.appendChild(popup);
        activePopup = popup;
        button.setAttribute("aria-expanded", "true");
        positionPopup(popup, button);
        popup.querySelector("[data-change-name]").addEventListener("click", openNameEditor);
        popup.querySelector("[data-change-avatar]").addEventListener("click", openAvatarPicker);
        popup.querySelector("[data-popup-logout]").addEventListener("click", async () => {
            if (window.HomeStockOnline?.enabled) await window.HomeStockOnline.signOut();
            else {
                localStorage.removeItem("homestock-logged-in");
                localStorage.removeItem(CURRENT_USER_KEY);
            }
            location.href = "login.html";
        });
    }

    function openNameEditor() {
        const user = readUser() || {};
        const overlay = document.createElement("div");
        overlay.className = "profile-modal-backdrop";
        overlay.innerHTML = `<div class="profile-modal" role="dialog" aria-modal="true">
            <div class="profile-modal-head"><div><span class="eyebrow">PROFILE</span><h3>Change your name</h3></div><button type="button" class="profile-modal-close">×</button></div>
            <label class="profile-field-label" for="profileNameInput">Name</label>
            <input id="profileNameInput" class="profile-field" type="text" maxlength="60" value="${escapeHtml(user.name || "")}" autocomplete="name">
            <p class="profile-modal-note">This name will appear throughout HomeStock.</p>
            <div class="profile-modal-actions"><button type="button" class="button secondary" data-cancel>Cancel</button><button type="button" class="button primary" data-save>Save name</button></div>
        </div>`;
        document.body.appendChild(overlay);
        const input = overlay.querySelector("#profileNameInput"); input.focus(); input.select();
        const close = () => overlay.remove();
        overlay.querySelector(".profile-modal-close").onclick = close;
        overlay.querySelector("[data-cancel]").onclick = close;
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
        overlay.querySelector("[data-save]").onclick = async () => {
            const name = input.value.trim(); if (!name) return input.focus();
            const saveButton = overlay.querySelector("[data-save]"); saveButton.disabled = true; saveButton.textContent = "Saving…";
            try {
                if (window.HomeStockOnline?.enabled) await window.HomeStockOnline.updateProfile({ name });
                saveLocalUser({ name }); refreshUserDisplay(); closePopup(); close();
            } catch (error) { saveButton.disabled = false; saveButton.textContent = "Save name"; alert(error.message || "Could not update your name."); }
        };
    }

    function openAvatarPicker() {
        const user = readUser() || {};
        const overlay = document.createElement("div");
        overlay.className = "profile-modal-backdrop";
        overlay.innerHTML = `<div class="profile-modal" role="dialog" aria-modal="true">
            <div class="profile-modal-head"><div><span class="eyebrow">PROFILE PICTURE</span><h3>Choose your avatar</h3></div><button type="button" class="profile-modal-close">×</button></div>
            <p class="profile-modal-note">Pick the cartoon you want to represent you.</p>
            <div class="avatar-grid">${AVATARS.map((avatar, i) => `<button type="button" class="avatar-choice ${avatar === (user.avatar || "🙂") ? "selected" : ""}" data-avatar="${i}" aria-label="Avatar ${i + 1}">${avatar}</button>`).join("")}</div>
            <div class="profile-modal-actions"><button type="button" class="button secondary" data-cancel>Cancel</button></div>
        </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector(".profile-modal-close").onclick = close;
        overlay.querySelector("[data-cancel]").onclick = close;
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
        overlay.querySelectorAll("[data-avatar]").forEach(button => button.addEventListener("click", async () => {
            const avatar = AVATARS[Number(button.dataset.avatar)];
            try {
                if (window.HomeStockOnline?.enabled) await window.HomeStockOnline.updateProfile({ avatar });
                saveLocalUser({ avatar }); refreshUserDisplay(); closePopup(); close();
            } catch (error) { alert(error.message || "Could not update your profile picture."); }
        }));
    }

    window.addEventListener("homestock-data-changed", refreshUserDisplay);

    document.addEventListener("DOMContentLoaded", () => {
        refreshUserDisplay();
        document.querySelectorAll("[data-profile-toggle]").forEach(button => {
            button.addEventListener("click", e => { e.preventDefault(); activePopup ? closePopup() : showPopup(button); });
        });
        document.querySelectorAll("[data-change-name-page]").forEach(button => {
            button.addEventListener("click", e => { e.preventDefault(); openNameEditor(); });
        });
        document.querySelectorAll("[data-change-avatar-page]").forEach(button => {
            button.addEventListener("click", e => { e.preventDefault(); openAvatarPicker(); });
        });
        document.addEventListener("click", e => {
            if (activePopup && !activePopup.contains(e.target) && !e.target.closest("[data-profile-toggle]")) closePopup();
        });
        window.addEventListener("resize", closePopup);
        window.addEventListener("scroll", closePopup, true);
    });
})();
