// js/admin.js

window.fetchBookingsFromSupabase = async function () {
    if (!window.appSupabaseClient) return { success: false, reason: "not_configured", data: [] };
    try {
        const { data, error } = await window.appSupabaseClient
            .from("bookings")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) return { success: false, reason: "fetch_error", error: error, data: [] };
        return { success: true, data: data || [] };
    } catch (error) {
        return { success: false, reason: "unexpected_error", error: error, data: [] };
    }
};

window.deleteBookingInSupabase = async function (id) {
    if (!window.appSupabaseClient) return { success: false };
    try {
        const { error } = await window.appSupabaseClient.from("bookings").delete().eq("id", id);
        if (error) return { success: false, error: error };
        return { success: true };
    } catch (error) {
        return { success: false, error: error };
    }
};

async function updateBookingStatusInSupabase(id, newStatus) {
    if (!window.appSupabaseClient) return { success: false };
    try {
        var resp = await window.appSupabaseClient.from("bookings").update({ status: newStatus }).eq("id", id);
        if (resp.error) return { success: false, error: resp.error };
        return { success: true };
    } catch (err) {
        return { success: false, error: err };
    }
}

document.addEventListener("DOMContentLoaded", function() {
    // Only run if we are on the admin dashboard page natively (has table)
    var bookingsTable = document.querySelector(".table-container .table");
    if (!bookingsTable) return;

    var statusNode = document.createElement("p");
    statusNode.style.cssText = "margin:8px 0 14px; color:#fff;";
    bookingsTable.parentNode.insertBefore(statusNode, bookingsTable);

    function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function updateStatsCards(rows) {
        var statTotal = document.getElementById("stat-total");
        var statToday = document.getElementById("stat-today");
        var statPending = document.getElementById("stat-pending");
        var statAccepted = document.getElementById("stat-accepted");

        if (!statTotal) return; // Fallback cards update not found

        var total = rows.length;
        var todayStr = new Date().toISOString().split("T")[0];
        var todayCount = 0, pendingCount = 0, acceptedCount = 0;

        for (var i = 0; i < rows.length; i++) {
            if (rows[i].date === todayStr) todayCount++;
            if (rows[i].status === "Pending") pendingCount++;
            if (rows[i].status === "Accepted") acceptedCount++;
        }

        statTotal.textContent = total;
        statToday.textContent = todayCount;
        statPending.textContent = pendingCount;
        statAccepted.textContent = acceptedCount;
    }

    function collectRowDataForStats() {
        if (!bookingsTable) return [];
        var rows = bookingsTable.querySelectorAll("tr");
        var data = [];
        for (var i = 1; i < rows.length; i++) {
            var cells = rows[i].querySelectorAll("td");
            if (cells.length >= 7) data.push({ date: cells[4].textContent, status: cells[6].textContent });
        }
        return data;
    }

    function buildActionButtons(bookingId, status) {
        var html = "";
        if (status === "Pending") {
            html += "<a href='#' class='button supa-accept-btn' data-id='" + escapeHtml(bookingId) + "' style='background:#16a34a;color:#fff;margin-right:4px;'>Accept</a>";
        }
        html += "<a href='#' class='button supa-delete-btn' data-id='" + escapeHtml(bookingId) + "'>Delete</a>";
        return html;
    }

    function renderSupabaseRows(rows) {
        if (!bookingsTable) return;
        var allRows = bookingsTable.querySelectorAll("tr");
        for (var i = 1; i < allRows.length; i++) allRows[i].remove(); // Clear placeholder rows

        rows.forEach(function (b) {
            var tr = document.createElement("tr");
            var displayTime = escapeHtml(b.time);
            try {
                if (b.time && b.time.match(/^\d{2}:\d{2}$/)) {
                    var parts = b.time.split(":");
                    var h = parseInt(parts[0], 10);
                    var ampm = h >= 12 ? "PM" : "AM";
                    h = h % 12 || 12;
                    displayTime = h + ":" + parts[1] + " " + ampm;
                }
            } catch(e) {}

            tr.innerHTML = 
                "<td>" + escapeHtml(b.id) + "</td>" +
                "<td>" + escapeHtml(b.name) + "</td>" +
                "<td>" + escapeHtml(b.phone) + "</td>" +
                "<td>" + escapeHtml(b.service) + "</td>" +
                "<td>" + escapeHtml(b.date) + "</td>" +
                "<td>" + displayTime + "</td>" +
                "<td>" + escapeHtml(b.status) + "</td>" +
                "<td>" + buildActionButtons(b.id, b.status) + "</td>";
            bookingsTable.appendChild(tr);
        });
    }

    async function loadSupabaseBookings() {
        statusNode.textContent = "Loading bookings from Supabase...";
        var bookingsResult = await window.fetchBookingsFromSupabase();
        
        if (!bookingsResult.success) {
            statusNode.textContent = "Supabase fetch failed.";
            return;
        }

        var data = bookingsResult.data || [];
        statusNode.textContent = "Loaded " + data.length + " booking(s) from Supabase.";
        renderSupabaseRows(data);
        updateStatsCards(data);
    }

    // Delegated click handler
    bookingsTable.addEventListener("click", async function (event) {
        var target = event.target;
        if (!target) return;

        if (target.classList.contains("supa-accept-btn")) {
            event.preventDefault();
            var acceptId = target.getAttribute("data-id");
            target.textContent = "Accepting...";
            target.style.pointerEvents = "none";

            var result = await updateBookingStatusInSupabase(acceptId, "Accepted");
            if (!result.success) {
                alert("Accept failed.");
                target.textContent = "Accept";
                target.style.pointerEvents = "";
                return;
            }

            var row = target.closest("tr");
            if (row) {
                var cells = row.querySelectorAll("td");
                if (cells.length >= 8) {
                    cells[6].textContent = "Accepted";
                    cells[7].innerHTML = buildActionButtons(acceptId, "Accepted");
                }
            }
            updateStatsCards(collectRowDataForStats());
            return;
        }

        if (target.classList.contains("supa-delete-btn")) {
            event.preventDefault();
            var deleteId = target.getAttribute("data-id");
            if (!confirm("Delete booking #" + deleteId + "?")) return;

            target.textContent = "Deleting...";
            target.style.pointerEvents = "none";
            var delResult = await window.deleteBookingInSupabase(deleteId);

            if (!delResult.success) {
                alert("Delete failed.");
                target.textContent = "Delete";
                target.style.pointerEvents = "";
                return;
            }

            var delRow = target.closest("tr");
            if (delRow) delRow.remove();
            updateStatsCards(collectRowDataForStats());
            return;
        }
    });

    // Real-Time DB Subscription
    if (window.appSupabaseClient) {
        window.appSupabaseClient.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                (payload) => {
                    console.log('Realtime change received!', payload)
                    loadSupabaseBookings(); // Automatically re-fetch UI
                }
            )
            .subscribe()
    }

    // DEBUG MODE: Bypassing authGuard
    // Directly loading bookings without session validation
    loadSupabaseBookings();

    // Setup Logout (will redirect but no longer protects load)
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (window.appSupabaseClient) {
                await window.appSupabaseClient.auth.signOut();
            }
            window.location.href = '../login/';
            // ============================================
    // ADMINS MANAGEMENT LOGIC
    // ============================================
    var adminsTable = document.querySelector("#adminsTable");
    var addAdminForm = document.getElementById("addAdminForm");

    window.fetchAdminsFromSupabase = async function () {
        if (!window.appSupabaseClient) return { success: false, data: [] };
        try {
            const { data, error } = await window.appSupabaseClient
                .from("admins").select("*").order("created_at", { ascending: false });
            if (error) return { success: false, error: error, data: [] };
            return { success: true, data: data || [] };
        } catch (error) { return { success: false, error: error, data: [] }; }
    };

    function renderAdminsRows(rows) {
        if (!adminsTable) return;
        var allRows = adminsTable.querySelectorAll("tr");
        for (var i = 1; i < allRows.length; i++) allRows[i].remove(); 

        rows.forEach(function (a) {
            var tr = document.createElement("tr");
            tr.innerHTML = 
                "<td>" + escapeHtml(a.id).substring(0,8) + "...</td>" +
                "<td>" + escapeHtml(a.email) + "</td>" +
                "<td>" + escapeHtml(a.role) + "</td>" +
                "<td><a href='#' class='button supa-admin-delete-btn' data-id='" + escapeHtml(a.id) + "'>Delete</a></td>";
            adminsTable.appendChild(tr);
        });
    }

    async function loadSupabaseAdmins() {
        var adminsResult = await window.fetchAdminsFromSupabase();
        if (adminsResult.success) {
            renderAdminsRows(adminsResult.data);
        } else {
            console.error("Dashboard failed to fetch admins: ", adminsResult.error);
        }
    }

    if (addAdminForm) {
        addAdminForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            var btn = addAdminForm.querySelector('button');
            var emailVal = document.getElementById("newAdminEmail").value.trim();
            var roleVal = document.getElementById("newAdminRole").value;

            if (!emailVal) return;
            btn.textContent = "Adding...";
            
            var payload = { email: emailVal, role: roleVal };
            console.log("ADMIN INSERT DATA:", payload);

            try {
                var { error } = await window.appSupabaseClient.from("admins").insert([payload]);

                if (error) {
                    console.log("ADMIN INSERT ERROR:", error);
                    alert("Failed to add admin metadata: " + error.message);
                } else {
                    document.getElementById("newAdminEmail").value = "";
                    loadSupabaseAdmins(); // Refresh table visually
                }
            } catch(err) {
                 console.log("ADMIN INSERT ERROR:", err);
                 alert("Failed to add admin metadata.");
            }
            btn.textContent = "Add Admin Role";
        });
    }

    if (adminsTable) {
        adminsTable.addEventListener("click", async function (event) {
            var target = event.target;
            if (!target) return;

            if (target.classList.contains("supa-admin-delete-btn")) {
                event.preventDefault();
                var deleteId = target.getAttribute("data-id");
                if (!confirm("Delete admin association?")) return;
                
                target.textContent = "Deleting...";
                try {
                    var { error } = await window.appSupabaseClient.from("admins").delete().eq("id", deleteId);
                    if (error) {
                        alert("Delete failed! See console.");
                        target.textContent = "Delete";
                    } else {
                        target.closest("tr").remove(); // Instantly removes row
                    }
                } catch(err) {
                    alert("Delete failed.");
                    target.textContent = "Delete";
                }
            }
        });
    }

    // Call load when dashboard opens
    loadSupabaseAdmins();

});
    }
});
