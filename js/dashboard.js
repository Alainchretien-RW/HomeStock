(() => {
    const ITEMS_KEY = "homestock-items";
    const ROOMS_KEY = "homestock-rooms";
    const CATEGORIES_KEY = "homestock-categories";
    const ACTIVITY_KEY = "homestock-activity";

    const readArray = (key) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    };

    const money = (value) => {
        if (typeof window.formatMoney === "function") return window.formatMoney(value);
        return `${Number(value || 0).toLocaleString("en-RW", { maximumFractionDigits: 0 })} RWF`;
    };

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

    function renderDashboard() {
        const stats = document.querySelectorAll(".stats .stat");
        const roomGrid = document.querySelector(".dash-grid .rooms");
        const activityPanel = document.querySelector(".dash-grid .activity");
        const bottom = document.querySelector(".bottom");
        if (!stats.length || !roomGrid || !activityPanel || !bottom) return;

        const panels = bottom.querySelectorAll(":scope > .panel");
        if (panels.length < 2) return;
        const valuesPanel = panels[0];
        const categoryPanel = panels[1];

        const items = readArray(ITEMS_KEY);
        const roomsStored = readArray(ROOMS_KEY);
        const categoriesStored = readArray(CATEGORIES_KEY);
        const activities = readArray(ACTIVITY_KEY);

        const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const totalValue = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

        // A room/category is tracked if it exists in the manager OR is referenced by inventory.
        const roomNames = [...new Set([
            ...roomsStored.map(r => r.name).filter(Boolean),
            ...items.map(i => i.room).filter(Boolean)
        ])];
        const categoryNames = [...new Set([
            ...categoriesStored.map(c => c.name).filter(Boolean),
            ...items.map(i => i.category).filter(Boolean)
        ])];

        const setStat = (index, value, small) => {
            const card = stats[index];
            if (!card) return;
            const strong = card.querySelector("strong");
            const smallEl = card.querySelector("small");
            if (strong) strong.textContent = value;
            if (smallEl) smallEl.textContent = small;
        };

        setStat(0, totalQuantity.toLocaleString(), `${items.length} inventory ${items.length === 1 ? "entry" : "entries"}`);
        setStat(1, money(totalValue), `Across ${roomNames.length} ${roomNames.length === 1 ? "room" : "rooms"}`);
        setStat(2, roomNames.length.toLocaleString(), `${totalQuantity.toLocaleString()} units tracked`);
        setStat(3, categoryNames.length.toLocaleString(), items.length ? "Live from inventory" : "No inventory yet");

        const roomImages = [
            "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80"
        ];
        const roomByName = new Map(roomsStored.map(r => [r.name, r]));
        roomGrid.innerHTML = roomNames.map((name, index) => {
            const ri = items.filter(i => i.room === name);
            const quantity = ri.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
            const value = ri.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
            const room = roomByName.get(name) || {};
            return `<a class="room" href="inventory.html?room=${encodeURIComponent(name)}"><img src="${esc(room.image || roomImages[index % roomImages.length])}" alt="${esc(name)}"><i class="tag teal-bg">${quantity.toLocaleString()} items</i><div><b>${esc(name)}</b><strong>${money(value)}</strong></div></a>`;
        }).join("") || `<p class="report-summary">No rooms yet.</p>`;

        const activityHead = activityPanel.querySelector(".section-title");
        activityPanel.innerHTML = "";
        if (activityHead) activityPanel.appendChild(activityHead);
        activities.slice(0, 6).forEach(a => {
            const row = document.createElement("div");
            row.className = "activity-row";
            const minutes = Math.max(0, Math.floor((Date.now() - new Date(a.at).getTime()) / 60000));
            const when = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) === 1 ? "" : "s"} ago` : `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) === 1 ? "" : "s"} ago`;
            const symbol = a.action === "Deleted" ? "−" : a.action === "Updated" ? "~" : "+";
            row.innerHTML = `<span>${symbol}</span><div><b>${esc(a.name)}</b><small>${esc(a.room || "No room")} · ${when}</small></div><strong>${money(a.value)}</strong>`;
            activityPanel.appendChild(row);
        });
        if (!activities.length) {
            const empty = document.createElement("p");
            empty.className = "report-summary";
            empty.textContent = "No recent activity yet.";
            activityPanel.appendChild(empty);
        }

        const valueHead = valuesPanel.querySelector(".panel-head");
        valuesPanel.innerHTML = "";
        if (valueHead) valuesPanel.appendChild(valueHead);
        [...items].sort((a,b) => (Number(b.value)||0) - (Number(a.value)||0)).slice(0,5).forEach((item,index) => {
            const row = document.createElement("div");
            row.className = "value";
            row.innerHTML = `<em>${String(index+1).padStart(2,"0")}</em><div><b>${esc(item.name)}</b><small>${esc(item.room || "No room")} · ${esc(item.category || "No category")}</small></div><strong>${money(item.value)}</strong>`;
            valuesPanel.appendChild(row);
        });
        if (!items.length) {
            const empty = document.createElement("p"); empty.className = "report-summary"; empty.textContent = "No inventory yet."; valuesPanel.appendChild(empty);
        }

        const catData = categoryNames.map(name => ({
            name,
            quantity: items.filter(i => i.category === name).reduce((sum,i) => sum + (Number(i.quantity)||0), 0)
        })).sort((a,b) => b.quantity - a.quantity);
        const max = Math.max(1, ...catData.map(c => c.quantity));
        const catHead = categoryPanel.querySelector(".panel-head");
        categoryPanel.innerHTML = "";
        if (catHead) categoryPanel.appendChild(catHead);
        const bars = document.createElement("div");
        bars.className = "bars";
        catData.slice(0, 8).forEach(c => {
            const label = document.createElement("label");
            label.innerHTML = `${esc(c.name)}<b>${c.quantity.toLocaleString()}</b>`;
            bars.appendChild(label);
            const bar = document.createElement("i");
            bar.innerHTML = `<span style="width:${Math.round(c.quantity / max * 100)}%"></span>`;
            bars.appendChild(bar);
        });
        categoryPanel.appendChild(bars);
        if (!catData.length) {
            const empty = document.createElement("p"); empty.className = "report-summary"; empty.textContent = "No categories yet."; categoryPanel.appendChild(empty);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!document.querySelector(".stats")) return;
        renderDashboard();
        window.addEventListener("homestock-data-changed", renderDashboard);
        window.addEventListener("storage", renderDashboard);
        setInterval(renderDashboard, 1000);
    });
})();
