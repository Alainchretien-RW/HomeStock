/* HomeStock v2 online sync layer.
   Uses Supabase REST so the existing HomeStock UI can keep its local data model.
   The app syncs inventory, rooms and categories for the signed-in household.
*/
(function () {
    const url = window.HOMESTOCK_SUPABASE_URL;
    const key = window.HOMESTOCK_SUPABASE_ANON_KEY;

    if (!url || !key || url.startsWith("YOUR_")) {
        console.warn("HomeStock: Supabase is not configured yet.");
        window.HomeStockOnline = { enabled: false };
        return;
    }

    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
    };

    async function request(path, options = {}) {
        const accessToken = localStorage.getItem("homestock-access-token");
        const response = await fetch(`${url}/rest/v1/${path}`, {
            ...options,
            headers: {
                ...headers,
                Authorization: `Bearer ${accessToken || key}`,
                ...(options.headers || {})
            }
        });
        if (!response.ok) throw new Error(await response.text());
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    async function session() {
        const token = localStorage.getItem("homestock-access-token");
        if (!token) return null;
        const response = await fetch(`${url}/auth/v1/user`, {
            headers: { apikey: key, Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return null;
        return response.json();
    }

    async function getProfile(userId) {
        const rows = await request(`profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
        return rows?.[0] || null;
    }

    function setToken(accessToken, refreshToken) {
        localStorage.setItem("homestock-access-token", accessToken);
        if (refreshToken) localStorage.setItem("homestock-refresh-token", refreshToken);
    }

    async function signUp(name, email, password) {
        const response = await fetch(`${url}/auth/v1/signup`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                email,
                password,
                data: { full_name: name }
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || data.error_description || data.message || "Registration failed.");
        if (data.access_token) setToken(data.access_token, data.refresh_token);
        return data;
    }

    async function signInWithGoogle() {
        const redirectTo = `${window.location.origin}/login.html`;
        const authorizeUrl = `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
        window.location.href = authorizeUrl;
    }

    function handleOAuthCallback() {
        if (!window.location.hash || !window.location.hash.includes("access_token=")) return false;
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (!accessToken) return false;
        setToken(accessToken, refreshToken);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        return true;
    }

    async function signIn(email, password) {
        const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers,
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || data.msg || "Incorrect email or password.");
        setToken(data.access_token, data.refresh_token);
        return data;
    }


    async function updateProfile({ name, avatar } = {}) {
        const token = localStorage.getItem("homestock-access-token");
        if (!token) throw new Error("Please log in again.");
        const current = await session();
        if (!current) throw new Error("Your session has expired. Please log in again.");
        const data = { ...(current.user_metadata || {}) };
        if (name !== undefined) data.full_name = name;
        if (avatar !== undefined) data.avatar = avatar;

        const response = await fetch(`${url}/auth/v1/user`, {
            method: "PUT",
            headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ data })
        });
        const updated = await response.json();
        if (!response.ok) throw new Error(updated.message || updated.error_description || "Unable to update profile.");

        try {
            const profilePatch = {};
            if (name !== undefined) profilePatch.full_name = name;
            if (Object.keys(profilePatch).length) {
                await request(`profiles?id=eq.${encodeURIComponent(current.id)}`, {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify(profilePatch)
                });
            }
        } catch (error) {
            console.warn("HomeStock profile table update skipped:", error);
        }

        const existing = JSON.parse(localStorage.getItem("homestock-current-user") || "{}");
        localStorage.setItem("homestock-current-user", JSON.stringify({
            ...existing,
            id: current.id,
            name: name !== undefined ? name : (existing.name || updated.user_metadata?.full_name || "HomeStock User"),
            email: updated.email || existing.email || "",
            avatar: avatar !== undefined ? avatar : (existing.avatar || updated.user_metadata?.avatar || "🙂")
        }));
        return updated;
    }

    async function signOut() {
        const token = localStorage.getItem("homestock-access-token");
        if (token) {
            await fetch(`${url}/auth/v1/logout`, {
                method: "POST",
                headers: { apikey: key, Authorization: `Bearer ${token}` }
            }).catch(() => {});
        }
        localStorage.removeItem("homestock-access-token");
        localStorage.removeItem("homestock-refresh-token");
        localStorage.removeItem("homestock-current-user");
        localStorage.removeItem("homestock-logged-in");
    }

    async function log(action, entityType, entityName, details = {}) {
        const user = await session();
        if (!user) return;
        const profile = await getProfile(user.id);
        if (!profile) return;
        await request("activity_log", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                household_id: profile.household_id,
                user_id: user.id,
                action,
                entity_type: entityType,
                entity_name: entityName,
                details
            })
        });
    }

    async function pull() {
        const user = await session();
        if (!user) return false;
        const profile = await getProfile(user.id);
        if (!profile) return false;

        const [items, rooms, categories] = await Promise.all([
            request(`inventory_items?household_id=eq.${profile.household_id}&select=*&order=created_at.desc`),
            request(`rooms?household_id=eq.${profile.household_id}&select=*&order=created_at.asc`),
            request(`categories?household_id=eq.${profile.household_id}&select=*&order=created_at.asc`)
        ]);

        localStorage.setItem("homestock-items", JSON.stringify((items || []).map((item) => ({
            id: item.id,
            name: item.name,
            room: item.room,
            category: item.category,
            quantity: Number(item.quantity),
            value: Number(item.value),
            min: Number(item.min_quantity)
        }))));

        localStorage.setItem("homestock-rooms", JSON.stringify((rooms || []).map((room) => ({
            id: room.id,
            name: room.name,
            description: room.description || "",
            image: room.image || ""
        }))));

        localStorage.setItem("homestock-categories", JSON.stringify((categories || []).map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description || "",
            color: category.color || "teal"
        }))));

        localStorage.setItem("homestock-current-user", JSON.stringify({
            id: user.id,
            name: user.user_metadata?.full_name || profile.full_name || user.email?.split("@")[0] || "HomeStock User",
            email: user.email,
            avatar: user.user_metadata?.avatar || "🙂",
            role: profile.role,
            householdId: profile.household_id,
            inviteCode: null
        }));
        localStorage.setItem("homestock-logged-in", "true");
        window.dispatchEvent(new Event("homestock-data-changed"));
        return true;
    }

    async function pushAll() {
        const user = await session();
        if (!user) return;
        const profile = await getProfile(user.id);
        if (!profile) return;
        const householdId = profile.household_id;

        const items = JSON.parse(localStorage.getItem("homestock-items") || "[]");
        const rooms = JSON.parse(localStorage.getItem("homestock-rooms") || "[]");
        const categories = JSON.parse(localStorage.getItem("homestock-categories") || "[]");

        const isUuid = (value) =>
            typeof value === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

        async function reconcile(table, localRows, toPayload) {
            const remote = await request(`${table}?household_id=eq.${encodeURIComponent(householdId)}&select=id`);
            const remoteIds = new Set((remote || []).map((row) => row.id));
            const localIds = new Set(localRows.filter((row) => isUuid(row.id)).map((row) => row.id));

            const idsToDelete = [...remoteIds].filter((id) => !localIds.has(id));
            for (const id of idsToDelete) {
                await request(`${table}?id=eq.${encodeURIComponent(id)}&household_id=eq.${encodeURIComponent(householdId)}`, {
                    method: "DELETE",
                    headers: { Prefer: "return=minimal" }
                });
            }

            const payload = localRows.map((row) => toPayload(row, isUuid(row.id)));
            if (payload.length) {
                await request(table, {
                    method: "POST",
                    headers: {
                        Prefer: "resolution=merge-duplicates,return=minimal"
                    },
                    body: JSON.stringify(payload)
                });
            }
        }

        await reconcile("inventory_items", items, (item, hasUuid) => ({
            ...(hasUuid ? { id: item.id } : {}),
            household_id: householdId,
            name: item.name,
            room: item.room,
            category: item.category,
            quantity: Number(item.quantity),
            value: Number(item.value),
            min_quantity: Number(item.min)
        }));

        await reconcile("rooms", rooms, (room, hasUuid) => ({
            ...(hasUuid ? { id: room.id } : {}),
            household_id: householdId,
            name: room.name,
            description: room.description || "",
            image: room.image || ""
        }));

        await reconcile("categories", categories, (category, hasUuid) => ({
            ...(hasUuid ? { id: category.id } : {}),
            household_id: householdId,
            name: category.name,
            description: category.description || "",
            color: category.color || "teal"
        }));
    }

    async function saveAndSync() {
        if (!window.HomeStockOnline?.enabled) return;
        try {
            await pushAll();
            await pull();
        } catch (error) {
            console.warn("HomeStock online sync failed:", error);
        }
    }

    window.HomeStockOnline = {
        enabled: true,
        signUp,
        signIn,
        signInWithGoogle,
        handleOAuthCallback,
        signOut,
        session,
        getProfile,
        updateProfile,
        getMembers: async function (householdId) {
            return await request(`profiles?household_id=eq.${encodeURIComponent(householdId)}&select=id,full_name,role,created_at&order=created_at.desc&limit=12`);
        },
        pull,
        pushAll,
        log,
        sync: saveAndSync,
        saveAndSync
    };

    document.addEventListener("DOMContentLoaded", async () => {
        if (await session()) {
            try { await pull(); } catch (error) { console.warn("HomeStock sync failed:", error); }
            setInterval(async () => {
                try { await pull(); } catch (_) {}
            }, 5000);
        }
    });
})();
