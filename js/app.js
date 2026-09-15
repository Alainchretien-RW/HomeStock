const KEY = "homestock-items";

const seed = [
    ["Sony 65\" OLED TV", "Living Room", "Electronics", 1, 2800, 1],
    ["MacBook Pro 16\"", "Home Office", "Electronics", 1, 3200, 1],
    ["Herman Miller Aeron Chair", "Home Office", "Furniture", 1, 1600, 1],
    ["KitchenAid Stand Mixer", "Kitchen", "Appliances", 1, 450, 1],
    ["IKEA Poäng Chair", "Living Room", "Furniture", 2, 199, 1],
    ["Tempur-Pedic Mattress", "Master Bedroom", "Furniture", 1, 2100, 1],
    ["Sub-Zero Refrigerator", "Kitchen", "Appliances", 1, 2400, 1],
    ["Weber Genesis Grill", "Garage", "Tools", 1, 1100, 1],
    ["Dyson V15 Vacuum", "Living Room", "Appliances", 1, 750, 2],
    ["Ninja Air Fryer", "Kitchen", "Appliances", 1, 180, 1],
    ["Canon Camera Kit", "Home Office", "Electronics", 0, 900, 1],
    ["Samsung 55\" QLED TV", "Master Bedroom", "Electronics", 1, 1200, 2],
    ["Oak Dining Table", "Dining Room", "Furniture", 1, 1280, 1],
    ["Cordless Drill Set", "Garage", "Tools", 1, 220, 2],
    ["Winter Jacket", "Master Bedroom", "Clothing", 2, 180, 2],
    ["Robot Mop", "Kitchen", "Appliances", 1, 430, 2],
    ["Standing Desk", "Home Office", "Furniture", 1, 650, 1],
    ["Bluetooth Speaker", "Living Room", "Electronics", 3, 300, 2],
    ["Toolbox", "Garage", "Tools", 1, 160, 1],
    ["Dinnerware Set", "Dining Room", "Appliances", 1, 210, 2]
].map((item, index) => ({
    id: index + 1,
    name: item[0],
    room: item[1],
    category: item[2],
    quantity: item[3],
    value: item[4],
    min: item[5]
}));

function getItems() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        return Array.isArray(saved) ? saved : seed;
    } catch {
        return seed;
    }
}

function recordLocalActivity(action, item) {
    try {
        const activities = JSON.parse(localStorage.getItem("homestock-activity") || "[]");
        activities.unshift({
            id: Date.now() + Math.random(),
            action,
            name: item?.name || "Inventory",
            room: item?.room || "",
            category: item?.category || "",
            value: Number(item?.value) || 0,
            at: new Date().toISOString()
        });
        localStorage.setItem("homestock-activity", JSON.stringify(activities.slice(0, 30)));
    } catch (_) {}
}

function saveItems(items) {
    let previous = [];
    try { previous = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) {}
    const previousMap = new Map(previous.map(item => [String(item.id), item]));
    const nextMap = new Map(items.map(item => [String(item.id), item]));

    items.forEach(item => {
        const old = previousMap.get(String(item.id));
        if (!old) recordLocalActivity("Added", item);
        else if (JSON.stringify(old) !== JSON.stringify(item)) recordLocalActivity("Updated", item);
    });
    previous.forEach(item => {
        if (!nextMap.has(String(item.id))) recordLocalActivity("Deleted", item);
    });

    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("homestock-data-changed"));
    window.HomeStockOnline?.saveAndSync?.();
}

function loadRoomOptions(selectedRoom = "") {
    const roomSelect = document.querySelector("#room");

    if (!roomSelect) {
        return;
    }

    const defaultRoomNames = [
        "Living Room",
        "Kitchen",
        "Master Bedroom",
        "Home Office",
        "Garage",
        "Dining Room"
    ];

    let savedRoomNames = [];

    try {
        const savedRooms = JSON.parse(localStorage.getItem("homestock-rooms"));

        if (Array.isArray(savedRooms)) {
            savedRoomNames = savedRooms
                .map((room) => room.name)
                .filter(Boolean);
        }
    } catch {
        savedRoomNames = [];
    }

    const roomNames = [...new Set([
        ...defaultRoomNames,
        ...savedRoomNames
    ])];

    roomSelect.innerHTML = roomNames
        .map((roomName) => `
            <option value="${escapeHtml(roomName)}">
                ${escapeHtml(roomName)}
            </option>
        `)
        .join("");

    if (selectedRoom && roomNames.includes(selectedRoom)) {
        roomSelect.value = selectedRoom;
    }
}


function loadCategoryOptions(selectedCategory = "") {
    const categorySelect = document.querySelector("#category");

    if (!categorySelect) {
        return;
    }

    const defaultCategories = [
        "Electronics",
        "Furniture",
        "Appliances",
        "Clothing",
        "Tools"
    ];

    let savedCategories = [];

    try {
        const categories = JSON.parse(
            localStorage.getItem("homestock-categories")
        );

        if (Array.isArray(categories)) {
            savedCategories = categories
                .map((category) => category.name)
                .filter(Boolean);
        }
    } catch {
        savedCategories = [];
    }

    const categoryNames = [...new Set([
        ...defaultCategories,
        ...savedCategories,
        selectedCategory
    ].filter(Boolean))];

    categorySelect.innerHTML = categoryNames
        .map((name) => `
            <option value="${escapeHtml(name)}">
                ${escapeHtml(name)}
            </option>
        `)
        .join("");

    if (selectedCategory && categoryNames.includes(selectedCategory)) {
        categorySelect.value = selectedCategory;
    }
}

function getStatus(item) {
    if (Number(item.quantity) === 0) return "out";
    if (Number(item.quantity) <= Number(item.min)) return "low";
    return "in";
}

function formatMoney(value) {
    return `${Number(value).toLocaleString("en-RW", {
        maximumFractionDigits: 0
    })} RWF`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}

function exportCsv(items) {
    const rows = [
        ["Item", "Room", "Category", "Quantity", "Value", "Status"],
        ...items.map((item) => [
            item.name,
            item.room,
            item.category,
            item.quantity,
            item.value,
            getStatus(item)
        ])
    ];

    const text = rows
        .map((row) =>
            row
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(",")
        )
        .join("\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(
        new Blob([text], { type: "text/csv" })
    );
    link.download = "homestock-inventory.csv";
    link.click();
}

document.addEventListener("DOMContentLoaded", () => {
    const rows = document.querySelector("#rows");

    if (!rows) return;

    let items = getItems();
    let filter = "all";
    const params = new URLSearchParams(window.location.search);
    let query = params.get("room") || params.get("category") || "";

    const searchInput = document.querySelector("#search");
    if (searchInput) {
        searchInput.value = query;
    }

    function render() {
        const filteredItems = items.filter((item) => {
            const matchesFilter =
                filter === "all" || getStatus(item) === filter;

            const searchText = `${item.name} ${item.room} ${item.category}`
                .toLowerCase();

            const matchesSearch = searchText.includes(query.toLowerCase());

            return matchesFilter && matchesSearch;
        });

        rows.innerHTML = filteredItems.length
            ? filteredItems
                  .map((item) => {
                      const status = getStatus(item);
                      let categoryClass = "";

                      if (item.category === "Furniture") {
                          categoryClass = "purple";
                      } else if (item.category === "Appliances") {
                          categoryClass = "orange";
                      } else if (item.category === "Clothing") {
                          categoryClass = "pink";
                      }

                      const statusText =
                          status === "out"
                              ? "Out of Stock"
                              : status === "low"
                              ? "Low Stock"
                              : "In Stock";

                      return `
                        <tr>
                            <td>${escapeHtml(item.name)}</td>
                            <td>${escapeHtml(item.room)}</td>
                            <td>
                                <span class="cat ${categoryClass}">
                                    ${escapeHtml(item.category)}
                                </span>
                            </td>
                            <td>${item.quantity}</td>
                            <td class="value-cell">
                                ${formatMoney(item.value)}
                            </td>
                            <td>
                                <span class="status ${status}">
                                    ${statusText}
                                </span>
                            </td>
                            <td>
                                <button class="act edit" data-id="${item.id}">
                                    ✎ Edit
                                </button>
                                <button class="act del" data-id="${item.id}">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `;
                  })
                  .join("")
            : `
                <tr>
                    <td colspan="7" style="text-align: center; height: 90px;">
                        No items found.
                    </td>
                </tr>
            `;

        document.querySelector("#allCount").textContent = items.length;
        document.querySelector("#lowCount").textContent = items.filter(
            (item) => getStatus(item) === "low"
        ).length;
        document.querySelector("#outCount").textContent = items.filter(
            (item) => getStatus(item) === "out"
        ).length;
        document.querySelector("#count").textContent = filteredItems.length;
        document.querySelector("#total").textContent = formatMoney(
            filteredItems.reduce((total, item) => total + Number(item.value), 0)
        );
        document.querySelector("#showing").textContent =
            `Showing ${filteredItems.length} of ${items.length} items`;
    }

    document.querySelector("#search").addEventListener("input", (event) => {
        query = event.target.value;
        render();
    });

    document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((tab) => {
                tab.classList.remove("active");
            });

            button.classList.add("active");
            filter = button.dataset.filter;
            render();
        });
    });

    const modal = document.querySelector("#modal");
    const form = document.querySelector("#form");

    function openModal(item = null) {
        modal.hidden = false;

        document.querySelector("#editId").value = item?.id || "";
        document.querySelector("#modalTitle").textContent = item
            ? "Edit Item"
            : "Add New Item";
        document.querySelector("#save").textContent = item
            ? "Save Changes"
            : "+ Add Item";
        document.querySelector("#name").value = item?.name || "";

        loadRoomOptions(item?.room || "Living Room");

        document.querySelector("#room").value =
            item?.room || "Living Room";

        loadCategoryOptions(item?.category || "Electronics");

        document.querySelector("#category").value =
            item?.category || "Electronics";
        document.querySelector("#qty").value = item?.quantity ?? 1;
        document.querySelector("#value").value = item?.value ?? 0;
        document.querySelector("#min").value = item?.min ?? 1;

        updatePreview();
    }

    function closeModal() {
        modal.hidden = true;
        form.reset();
        updatePreview();
    }

    function updatePreview() {
        const quantity = Number(document.querySelector("#qty").value) || 0;
        const minimum = Number(document.querySelector("#min").value) || 0;
        const preview = document.querySelector("#preview");

        if (quantity === 0) {
            preview.textContent = "● Out of Stock";
            preview.className = "out";
        } else if (quantity <= minimum) {
            preview.textContent = "● Low Stock";
            preview.className = "";
        } else {
            preview.textContent = "● In Stock";
            preview.className = "good";
        }
    }

    document.querySelector("#addItem").addEventListener("click", () => {
        openModal();
    });

    document.querySelector("#close").addEventListener("click", closeModal);
    document.querySelector("#cancel").addEventListener("click", closeModal);

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    ["qty", "min"].forEach((id) => {
        document.querySelector(`#${id}`).addEventListener("input", updatePreview);
    });

    rows.addEventListener("click", (event) => {
        const editButton = event.target.closest(".edit");
        const deleteButton = event.target.closest(".del");

        if (editButton) {
            const item = items.find(
                (entry) => entry.id == editButton.dataset.id
            );
            openModal(item);
        }

        if (deleteButton) {
            const item = items.find(
                (entry) => entry.id == deleteButton.dataset.id
            );

            if (item && confirm(`Delete "${item.name}"?`)) {
                items = items.filter((entry) => entry.id !== item.id);
                saveItems(items);
                render();
            }
        }
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const id = Number(document.querySelector("#editId").value);
        const item = {
            id: id || Date.now(),
            name: document.querySelector("#name").value.trim(),
            room: document.querySelector("#room").value,
            category: document.querySelector("#category").value,
            quantity: Number(document.querySelector("#qty").value),
            value: Number(document.querySelector("#value").value),
            min: Number(document.querySelector("#min").value)
        };

        if (
            !item.name ||
            item.quantity < 0 ||
            item.value < 0 ||
            item.min < 0
        ) {
            return;
        }

        if (id) {
            items = items.map((entry) => (entry.id === id ? item : entry));
        } else {
            items = [item, ...items];
        }

        saveItems(items);
        closeModal();
        render();
    });

    document.querySelector("#export").addEventListener("click", () => {
        exportCsv(items);
    });

    render();
});

document.querySelector("#exportDash")?.addEventListener("click", () => {
    exportCsv(getItems());
});

document.querySelectorAll(".collapse").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelector(".sidebar").classList.toggle("collapsed");
    });
});


/* Rooms page */
document.addEventListener("DOMContentLoaded", () => {
    const roomGrid = document.querySelector("#roomGrid");

    if (!roomGrid) {
        return;
    }

    const ROOM_KEY = "homestock-rooms";

    const defaultRooms = [
        {
            id: 1,
            name: "Living Room",
            description: "Sofa, TV, shelving & décor",
            image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=80"
        },
        {
            id: 2,
            name: "Kitchen",
            description: "Appliances, cookware & pantry",
            image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1000&q=80"
        },
        {
            id: 3,
            name: "Master Bedroom",
            description: "Bed, wardrobe & personal items",
            image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=80"
        },
        {
            id: 4,
            name: "Home Office",
            description: "Desk, electronics & storage",
            image: "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1000&q=80"
        },
        {
            id: 5,
            name: "Garage",
            description: "Tools, vehicles & outdoor gear",
            image: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1000&q=80"
        },
        {
            id: 6,
            name: "Dining Room",
            description: "Table, chairs & serving ware",
            image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80"
        }
    ];

    function getStoredRooms() {
        try {
            const saved = JSON.parse(localStorage.getItem(ROOM_KEY));
            return Array.isArray(saved) && saved.length ? saved : defaultRooms;
        } catch {
            return defaultRooms;
        }
    }

    function saveRooms(rooms) {
        localStorage.setItem(ROOM_KEY, JSON.stringify(rooms));
        window.dispatchEvent(new Event("homestock-data-changed"));
        window.HomeStockOnline?.saveAndSync?.();
    }

    function getItemsForRoom(roomName) {
        try {
            const saved = JSON.parse(localStorage.getItem(KEY));
            const items = Array.isArray(saved) ? saved : seed;

            if (roomName === "__all__") {
                return items;
            }

            return items.filter((item) => item.room === roomName);
        } catch {
            if (roomName === "__all__") {
                return seed;
            }

            return seed.filter((item) => item.room === roomName);
        }
    }

    function renderRooms() {
        const search = document.querySelector("#roomSearch");
        const query = search ? search.value.trim().toLowerCase() : "";
        const rooms = getStoredRooms();

        const visibleRooms = rooms.filter((room) => {
            return `${room.name} ${room.description}`
                .toLowerCase()
                .includes(query);
        });

        const allItems = getItemsForRoom("__all__");
        const inventoryItems = (() => {
            try {
                const saved = JSON.parse(localStorage.getItem(KEY));
                return Array.isArray(saved) ? saved : seed;
            } catch {
                return seed;
            }
        })();

        document.querySelector("#roomCount").textContent = rooms.length;
        document.querySelector("#roomItemCount").textContent =
            inventoryItems.reduce((total, item) => total + Number(item.quantity), 0);

        document.querySelector("#roomTotalValue").textContent = formatMoney(
            inventoryItems.reduce((total, item) => total + Number(item.value), 0)
        );

        roomGrid.innerHTML = visibleRooms
            .map((room, index) => {
                const roomItems = getItemsForRoom(room.name);
                const itemCount = roomItems.reduce(
                    (total, item) => total + Number(item.quantity),
                    0
                );
                const roomValue = roomItems.reduce(
                    (total, item) => total + Number(item.value),
                    0
                );

                return `
                    <article class="room-card">
                        <div class="room-photo">
                            <img
                                src="${escapeHtml(room.image)}"
                                alt="${escapeHtml(room.name)}"
                            >
                            <span class="room-count">
                                ${itemCount} items
                            </span>
                        </div>

                        <div class="room-card-body">
                            <div class="room-card-title">
                                <h2>${escapeHtml(room.name)}</h2>
                                <strong class="room-value">
                                    ${formatMoney(roomValue)}
                                </strong>
                            </div>

                            <p class="room-description">
                                ${escapeHtml(room.description)}
                            </p>

                            <div class="room-stats">
                                <span class="dot"></span>
                                <span>${itemCount} items tracked</span>
                                <span>|</span>
                                <span>${formatMoney(roomValue)} est. value</span>
                            </div>

                            <div class="room-actions">
                                <button
                                    class="room-view"
                                    type="button"
                                    data-room="${escapeHtml(room.name)}"
                                >
                                    View Items
                                </button>

                                <button
                                    class="room-edit"
                                    type="button"
                                    title="Edit room"
                                    data-edit-room="${room.id}"
                                >
                                    ✎
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            })
            .join("");

        const empty = document.querySelector("#roomEmpty");

        if (visibleRooms.length === 0 && query !== "") {
            roomGrid.hidden = true;
            empty.hidden = false;
            document.querySelector("#emptyMessage").textContent =
                `No rooms match "${search ? search.value : ""}".`;
        } else {
            roomGrid.hidden = false;
            empty.hidden = true;
        }

        document.querySelector("#roomFooter").textContent =
            `Showing ${visibleRooms.length} of ${rooms.length} rooms`;
    }

    function openRoomModal(room = null) {
        const modal = document.querySelector("#roomModal");

        modal.hidden = false;

        document.querySelector("#roomEditId").value = room?.id || "";
        document.querySelector("#roomModalTitle").textContent =
            room ? "Edit Room" : "Add New Room";
        document.querySelector("#roomName").value = room?.name || "";
        document.querySelector("#roomDescription").value =
            room?.description || "";
    }

    function closeRoomModal() {
        document.querySelector("#roomModal").hidden = true;
        document.querySelector("#roomForm").reset();
    }

    document.querySelector("#roomSearch").addEventListener("input", renderRooms);

    document.querySelector("#clearRoomSearch").addEventListener("click", () => {
        document.querySelector("#roomSearch").value = "";
        renderRooms();
    });

    document.querySelector("#addRoom").addEventListener("click", () => {
        openRoomModal();
    });

    document.querySelector("#closeRoomModal").addEventListener(
        "click",
        closeRoomModal
    );

    document.querySelector("#cancelRoom").addEventListener(
        "click",
        closeRoomModal
    );

    document.querySelector("#roomModal").addEventListener("click", (event) => {
        if (event.target.id === "roomModal") {
            closeRoomModal();
        }
    });

    document.querySelector("#roomForm").addEventListener("submit", (event) => {
        event.preventDefault();

        const id = Number(document.querySelector("#roomEditId").value);
        const name = document.querySelector("#roomName").value.trim();
        const description = document
            .querySelector("#roomDescription")
            .value.trim();

        if (!name || !description) {
            return;
        }

        const rooms = getStoredRooms();

        if (id) {
            const room = rooms.find((entry) => entry.id === id);

            if (room) {
                room.name = name;
                room.description = description;
            }
        } else {
            rooms.push({
                id: Date.now(),
                name,
                description,
                image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=80"
            });
        }

        saveRooms(rooms);
        closeRoomModal();
        renderRooms();
    });

    roomGrid.addEventListener("click", (event) => {
        const viewButton = event.target.closest(".room-view");
        const editButton = event.target.closest(".room-edit");

        if (viewButton) {
            const room = viewButton.dataset.room;
            window.location.href =
                `inventory.html?room=${encodeURIComponent(room)}`;
            return;
        }

        if (editButton) {
            const id = Number(editButton.dataset.editRoom);
            const room = getStoredRooms().find((entry) => entry.id === id);

            if (room) {
                openRoomModal(room);
            }
        }
    });

    document.querySelector("#exportRooms").addEventListener("click", () => {
        const rooms = getStoredRooms();
        const inventoryItems = getItemsForRoom("__all__");

        const rows = [
            ["Room", "Description", "Items", "Estimated Value"],
            ...rooms.map((room) => {
                const roomItems = inventoryItems.filter(
                    (item) => item.room === room.name
                );

                return [
                    room.name,
                    room.description,
                    roomItems.reduce(
                        (total, item) => total + Number(item.quantity),
                        0
                    ),
                    roomItems.reduce(
                        (total, item) => total + Number(item.value),
                        0
                    )
                ];
            })
        ];

        const csv = rows
            .map((row) =>
                row
                    .map((value) =>
                        `"${String(value).replaceAll('"', '""')}"`
                    )
                    .join(",")
            )
            .join("\n");

        const link = document.createElement("a");
        link.href = URL.createObjectURL(
            new Blob([csv], { type: "text/csv" })
        );
        link.download = "homestock-rooms.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    });

    renderRooms();
});


/* Categories page */
document.addEventListener("DOMContentLoaded", () => {
    const categoryGrid = document.querySelector("#categoryGrid");

    if (!categoryGrid) {
        return;
    }

    const CATEGORY_KEY = "homestock-categories";

    const defaultCategories = [
        {
            id: 1,
            name: "Electronics",
            description: "TVs, computers, audio & more",
            icon: "▣",
            color: "teal"
        },
        {
            id: 2,
            name: "Furniture",
            description: "Sofas, tables, chairs & storage",
            icon: "▰",
            color: "violet"
        },
        {
            id: 3,
            name: "Appliances",
            description: "Kitchen, laundry & home appliances",
            icon: "▤",
            color: "orange"
        },
        {
            id: 4,
            name: "Clothing",
            description: "Apparel, shoes & accessories",
            icon: "♧",
            color: "green"
        },
        {
            id: 5,
            name: "Tools",
            description: "Power tools, hand tools & equipment",
            icon: "⌕",
            color: "pink"
        }
    ];

    function getStoredCategories() {
        try {
            const saved = JSON.parse(localStorage.getItem(CATEGORY_KEY));

            if (Array.isArray(saved) && saved.length) {
                return saved;
            }
        } catch {
            return defaultCategories;
        }

        return defaultCategories;
    }

    function saveCategories(categories) {
        localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
        window.dispatchEvent(new Event("homestock-data-changed"));
        window.HomeStockOnline?.saveAndSync?.();
    }

    function getCategoryItems(categoryName) {
        return getItems().filter((item) => item.category === categoryName);
    }

    function getCategoryIcon(categoryName, fallback) {
        const icons = {
            Electronics: "▣",
            Furniture: "▰",
            Appliances: "▤",
            Clothing: "♧",
            Tools: "⌕"
        };

        return icons[categoryName] || fallback || "▤";
    }

    function getCategoryColor(category, index) {
        const colors = ["teal", "violet", "orange", "green", "pink"];
        return category.color || colors[index % colors.length];
    }

    function renderCategories() {
        const search = document.querySelector("#categorySearch");
        const query = search
            ? search.value.trim().toLowerCase()
            : "";

        const categories = getStoredCategories();
        const allItems = getItems();

        const totalQuantity = allItems.reduce(
            (total, item) => total + Number(item.quantity),
            0
        );

        const visibleCategories = categories.filter((category) => {
            return `${category.name} ${category.description}`
                .toLowerCase()
                .includes(query);
        });

        document.querySelector("#categoryCount").textContent =
            categories.length;

        document.querySelector("#categoryItemCount").textContent =
            totalQuantity;

        document.querySelector("#categoryTotalValue").textContent =
            formatMoney(
                allItems.reduce(
                    (total, item) => total + Number(item.value),
                    0
                )
            );

        categoryGrid.innerHTML = visibleCategories
            .map((category, index) => {
                const categoryItems = getCategoryItems(category.name);

                const itemCount = categoryItems.reduce(
                    (total, item) => total + Number(item.quantity),
                    0
                );

                const categoryValue = categoryItems.reduce(
                    (total, item) => total + Number(item.value),
                    0
                );

                const share = totalQuantity > 0
                    ? Math.round((itemCount / totalQuantity) * 100)
                    : 0;

                const color = getCategoryColor(category, index);

                return `
                    <article class="category-card ${color}">
                        <div class="category-card-top">
                            <div class="category-icon">
                                ${escapeHtml(
                                    getCategoryIcon(
                                        category.name,
                                        category.icon
                                    )
                                )}
                            </div>

                            <span class="category-count-badge">
                                ${itemCount} items
                            </span>
                        </div>

                        <div class="category-card-body">
                            <div class="category-card-title">
                                <h2>${escapeHtml(category.name)}</h2>
                                <strong class="category-value">
                                    ${formatMoney(categoryValue)}
                                </strong>
                            </div>

                            <p class="category-description">
                                ${escapeHtml(category.description)}
                            </p>

                            <div class="category-mini-stats">
                                <div>
                                    <span>Items</span>
                                    <b>${itemCount}</b>
                                </div>
                                <div>
                                    <span>Est. Value</span>
                                    <b>${formatMoney(categoryValue)}</b>
                                </div>
                            </div>

                            <div class="category-share">
                                <div>
                                    <span>Share of inventory</span>
                                    <span>${share}%</span>
                                </div>
                                <div class="category-progress">
                                    <span style="width:${share}%"></span>
                                </div>
                            </div>

                            <div class="category-actions">
                                <button
                                    class="category-edit"
                                    type="button"
                                    title="Edit category"
                                    data-category-edit="${category.id}"
                                >
                                    ✎
                                </button>

                                <button
                                    class="category-delete"
                                    type="button"
                                    title="Delete category"
                                    data-category-delete="${category.id}"
                                >
                                    ♜
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            })
            .join("");

        const empty = document.querySelector("#categoryEmpty");

        if (visibleCategories.length === 0 && query !== "") {
            categoryGrid.hidden = true;
            empty.hidden = false;

            document.querySelector("#categoryEmptyMessage").textContent =
                `No categories match "${search.value}".`;
        } else {
            categoryGrid.hidden = false;
            empty.hidden = true;
        }

        document.querySelector("#categoryFooter").textContent =
            `Showing ${visibleCategories.length} of ${categories.length} categories`;
    }

    function openCategoryModal(category = null) {
        const modal = document.querySelector("#categoryModal");

        modal.hidden = false;

        document.querySelector("#categoryEditId").value =
            category?.id || "";

        document.querySelector("#categoryModalTitle").textContent =
            category
                ? "Edit Category"
                : "Add New Category";

        document.querySelector("#categoryName").value =
            category?.name || "";

        document.querySelector("#categoryDescription").value =
            category?.description || "";

        setCategoryColor(category?.color || "teal");
    }

    function setCategoryColor(color) {
        const allowed = ["teal", "violet", "orange", "green", "pink", "blue"];
        const selected = allowed.includes(color) ? color : "teal";
        document.querySelector("#categoryColor").value = selected;

        document.querySelectorAll(".color-choice").forEach((button) => {
            button.classList.toggle("selected", button.dataset.color === selected);
        });
    }

    function closeCategoryModal() {
        document.querySelector("#categoryModal").hidden = true;
        document.querySelector("#categoryForm").reset();
        setCategoryColor("teal");
    }

    document.querySelectorAll(".color-choice").forEach((button) => {
        button.addEventListener("click", () => {
            setCategoryColor(button.dataset.color);
        });
    });

    document.querySelector("#categorySearch").addEventListener(
        "input",
        renderCategories
    );

    document.querySelector("#clearCategorySearch").addEventListener(
        "click",
        () => {
            document.querySelector("#categorySearch").value = "";
            renderCategories();
        }
    );

    document.querySelector("#addCategory").addEventListener(
        "click",
        () => {
            openCategoryModal();
        }
    );

    document.querySelector("#closeCategoryModal").addEventListener(
        "click",
        closeCategoryModal
    );

    document.querySelector("#cancelCategory").addEventListener(
        "click",
        closeCategoryModal
    );

    document.querySelector("#categoryModal").addEventListener(
        "click",
        (event) => {
            if (event.target.id === "categoryModal") {
                closeCategoryModal();
            }
        }
    );

    document.querySelector("#categoryForm").addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            const id = Number(
                document.querySelector("#categoryEditId").value
            );

            const name = document
                .querySelector("#categoryName")
                .value
                .trim();

            const description = document
                .querySelector("#categoryDescription")
                .value
                .trim();

            if (!name || !description) {
                return;
            }

            const categories = getStoredCategories();

            const duplicate = categories.some(
                (category) =>
                    category.id !== id &&
                    category.name.toLowerCase() === name.toLowerCase()
            );

            if (duplicate) {
                alert("That category already exists.");
                return;
            }

            if (id) {
                const category = categories.find(
                    (entry) => entry.id === id
                );

                if (category) {
                    const oldName = category.name;

                    category.name = name;
                    category.description = description;
                    category.color = document.querySelector("#categoryColor").value;

                    const items = getItems().map((item) => {
                        if (item.category === oldName) {
                            return {
                                ...item,
                                category: name
                            };
                        }

                        return item;
                    });

                    saveItems(items);
                }
            } else {
                categories.push({
                    id: Date.now(),
                    name,
                    description,
                    icon: "▤",
                    color: document.querySelector("#categoryColor").value
                });
            }

            saveCategories(categories);
            closeCategoryModal();
            renderCategories();
        }
    );

    categoryGrid.addEventListener("click", (event) => {
        const editButton = event.target.closest(".category-edit");
        const deleteButton = event.target.closest(".category-delete");

        if (editButton) {
            const id = Number(editButton.dataset.categoryEdit);

            const category = getStoredCategories().find(
                (entry) => entry.id === id
            );

            if (category) {
                openCategoryModal(category);
            }

            return;
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.categoryDelete);
            const categories = getStoredCategories();

            const category = categories.find(
                (entry) => entry.id === id
            );

            if (!category) {
                return;
            }

            const items = getCategoryItems(category.name);

            if (items.length > 0) {
                alert(
                    `You cannot delete "${category.name}" while it still has inventory items.`
                );
                return;
            }

            if (confirm(`Delete "${category.name}"?`)) {
                saveCategories(
                    categories.filter((entry) => entry.id !== id)
                );

                renderCategories();
            }
        }
    });

    document.querySelector("#exportCategories")?.addEventListener(
        "click",
        () => {
            const categories = getStoredCategories();

            const rows = [
                ["Category", "Description", "Items", "Estimated Value"],
                ...categories.map((category) => {
                    const categoryItems = getCategoryItems(category.name);

                    return [
                        category.name,
                        category.description,
                        categoryItems.reduce(
                            (total, item) =>
                                total + Number(item.quantity),
                            0
                        ),
                        categoryItems.reduce(
                            (total, item) =>
                                total + Number(item.value),
                            0
                        )
                    ];
                })
            ];

            const csv = rows
                .map((row) =>
                    row
                        .map((value) =>
                            `"${String(value).replaceAll('"', '""')}"`
                        )
                        .join(",")
                )
                .join("\n");

            const link = document.createElement("a");

            link.href = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" })
            );

            link.download = "homestock-categories.csv";
            link.click();

            URL.revokeObjectURL(link.href);
        }
    );

    renderCategories();
});


/* Reports page */
document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("#reportTotalItems")) {
        return;
    }

    function renderReport() {
        const items = getItems();

        const totalQuantity = items.reduce(
            (sum, item) => sum + Number(item.quantity),
            0
        );

        const totalValue = items.reduce(
            (sum, item) => sum + Number(item.value),
            0
        );

        const rooms = [...new Set(
            items.map((item) => item.room).filter(Boolean)
        )];

        const categories = [...new Set(
            items.map((item) => item.category).filter(Boolean)
        )];

        const inStock = items.filter(
            (item) => getStatus(item) === "In Stock"
        ).reduce((sum, item) => sum + Number(item.quantity), 0);

        const lowStock = items.filter(
            (item) => getStatus(item) === "Low Stock"
        ).reduce((sum, item) => sum + Number(item.quantity), 0);

        const outStock = items.filter(
            (item) => getStatus(item) === "Out of Stock"
        ).reduce((sum, item) => sum + Number(item.quantity), 0);

        document.querySelector("#reportTotalItems").textContent =
            totalQuantity;

        document.querySelector("#reportTotalValue").textContent =
            formatMoney(totalValue);

        document.querySelector("#reportRooms").textContent =
            rooms.length;

        document.querySelector("#reportCategories").textContent =
            categories.length;

        document.querySelector("#inStockCount").textContent = inStock;
        document.querySelector("#lowStockCount").textContent = lowStock;
        document.querySelector("#outStockCount").textContent = outStock;

        const categoryData = categories
            .map((name) => {
                const categoryItems = items.filter(
                    (item) => item.category === name
                );

                return {
                    name,
                    quantity: categoryItems.reduce(
                        (sum, item) => sum + Number(item.quantity),
                        0
                    ),
                    value: categoryItems.reduce(
                        (sum, item) => sum + Number(item.value),
                        0
                    )
                };
            })
            .sort((a, b) => b.quantity - a.quantity);

        const roomData = rooms
            .map((name) => {
                const roomItems = items.filter(
                    (item) => item.room === name
                );

                return {
                    name,
                    quantity: roomItems.reduce(
                        (sum, item) => sum + Number(item.quantity),
                        0
                    ),
                    value: roomItems.reduce(
                        (sum, item) => sum + Number(item.value),
                        0
                    )
                };
            })
            .sort((a, b) => b.quantity - a.quantity);

        const maxCategory = Math.max(
            ...categoryData.map((entry) => entry.quantity),
            1
        );

        const maxRoom = Math.max(
            ...roomData.map((entry) => entry.quantity),
            1
        );

        document.querySelector("#categoryReport").innerHTML =
            categoryData.map((entry) => `
                <div class="report-row">
                    <div class="report-row-head">
                        <strong>${escapeHtml(entry.name)}</strong>
                        <span>
                            ${entry.quantity} items ·
                            ${formatMoney(entry.value)}
                        </span>
                    </div>
                    <div class="report-progress">
                        <span style="width:${Math.round(
                            entry.quantity / maxCategory * 100
                        )}%"></span>
                    </div>
                </div>
            `).join("") || "<p class='report-summary'>No inventory yet.</p>";

        document.querySelector("#roomReport").innerHTML =
            roomData.map((entry) => `
                <div class="report-row">
                    <div class="report-row-head">
                        <strong>${escapeHtml(entry.name)}</strong>
                        <span>
                            ${entry.quantity} items ·
                            ${formatMoney(entry.value)}
                        </span>
                    </div>
                    <div class="report-progress">
                        <span style="width:${Math.round(
                            entry.quantity / maxRoom * 100
                        )}%"></span>
                    </div>
                </div>
            `).join("") || "<p class='report-summary'>No inventory yet.</p>";

        const topItems = [...items]
            .sort((a, b) => Number(b.value) - Number(a.value))
            .slice(0, 5);

        document.querySelector("#topItemsReport").innerHTML =
            topItems.map((item) => `
                <div class="report-row">
                    <div class="report-row-head">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${formatMoney(item.value)}</span>
                    </div>
                    <div class="report-row-meta">
                        ${escapeHtml(item.room)} ·
                        ${escapeHtml(item.category)} ·
                        ${item.quantity} units
                    </div>
                </div>
            `).join("") || "<p class='report-summary'>No inventory yet.</p>";

        const now = new Date();

        document.querySelector("#reportUpdated").textContent =
            `Updated ${now.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
            })}`;

        document.querySelector("#reportSummary").textContent =
            `HomeStock currently tracks ${totalQuantity} items across ` +
            `${rooms.length} rooms and ${categories.length} categories, ` +
            `with an estimated total value of ${formatMoney(totalValue)}. ` +
            `${lowStock} items are low stock and ${outStock} are out of stock.`;
    }

    document.querySelector("#generatePdf").addEventListener(
        "click",
        () => {
            window.print();
        }
    );

    document.querySelector("#exportReportCsv").addEventListener(
        "click",
        () => {
            const items = getItems();

            const rows = [
                ["Item", "Room", "Category", "Quantity", "Value", "Status"],
                ...items.map((item) => [
                    item.name,
                    item.room,
                    item.category,
                    item.quantity,
                    item.value,
                    getStatus(item)
                ])
            ];

            const csv = rows
                .map((row) =>
                    row.map((value) =>
                        `"${String(value).replaceAll('"', '""')}"`
                    ).join(",")
                )
                .join("\n");

            const link = document.createElement("a");
            link.href = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" })
            );
            link.download = "homestock-report.csv";
            link.click();
            URL.revokeObjectURL(link.href);
        }
    );

    renderReport();
});
