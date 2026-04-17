// js/admin.js

window.fetchBookingsFromSupabase = async function () {
    const client = window.getSupabaseClient();
    if (!client) return { success: false, reason: "not_configured", data: [] };
    try {
        const { data, error } = await client
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
    const client = window.getSupabaseClient();
    if (!client) return { success: false };
    try {
        const { error } = await client.from("bookings").delete().eq("id", id);
        if (error) return { success: false, error: error };
        return { success: true };
    } catch (error) {
        return { success: false, error: error };
    }
};

async function updateBookingStatusInSupabase(id, newStatus) {
    const client = window.getSupabaseClient();
    if (!client) return { success: false };
    try {
        var resp = await client.from("bookings").update({ status: newStatus }).eq("id", id);
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

        if (!statTotal) return; 

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
        for (var i = 1; i < allRows.length; i++) allRows[i].remove(); 

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
    const realtimeClient = window.getSupabaseClient();
    if (realtimeClient) {
        realtimeClient.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                (payload) => {
                    console.log('Realtime change received!', payload)
                    loadSupabaseBookings(); 
                }
            )
            .subscribe()
    }

    // Auth Guard Check
    const authCheck = async () => {
        const { success, session } = await window.getSupabaseSession();
        if (!success || !session) {
            console.log("No active session found. Redirecting to login...");
            window.location.href = "../login/";
            return;
        }
        console.log("Session verified. Loading data...");
        loadSupabaseBookings();
        loadSupabaseAdmins();
    };

    authCheck();

    // ============================================
    // ADMINS MANAGEMENT LOGIC
    // ============================================
    var adminsTable = document.querySelector("#adminsTable");
    var addAdminForm = document.getElementById("addAdminForm");

    window.fetchAdminsFromSupabase = async function () {
        const client = window.getSupabaseClient();
        if (!client) return { success: false, data: [] };
        try {
            const { data, error } = await client
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
        var adminMgmtStatus = document.getElementById("adminMgmtStatus");

        addAdminForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            const client = window.getSupabaseClient();
            if (!client || !adminMgmtStatus) return;

            var btn = addAdminForm.querySelector('button');
            var emailVal = document.getElementById("newAdminEmail").value.trim();
            var roleVal = document.getElementById("newAdminRole").value;

            if (!emailVal) return;
            
            btn.disabled = true;
            btn.textContent = "Adding...";
            adminMgmtStatus.textContent = "Adding " + emailVal + "...";
            adminMgmtStatus.style.color = "#FFD700";
            
            var payload = { email: emailVal, role: roleVal };

            try {
                var { error } = await client.from("admins").insert([payload]);

                if (error) {
                    console.error("ADMIN INSERT ERROR:", error);
                    adminMgmtStatus.textContent = "Failed: " + error.message;
                    adminMgmtStatus.style.color = "#ff4444";
                } else {
                    document.getElementById("newAdminEmail").value = "";
                    adminMgmtStatus.textContent = "Admin successfully added!";
                    adminMgmtStatus.style.color = "#16a34a";
                    loadSupabaseAdmins(); 
                }
            } catch(err) {
                 console.error("ADMIN INSERT ERROR:", err);
                 adminMgmtStatus.textContent = "An unexpected error occurred.";
                 adminMgmtStatus.style.color = "#ff4444";
            } finally {
                btn.disabled = false;
                btn.textContent = "Add Admin Role";
                setTimeout(() => { if (adminMgmtStatus) adminMgmtStatus.textContent = ""; }, 5000);
            }
        });
    }

    if (adminsTable) {
        adminsTable.addEventListener("click", async function (event) {
            var target = event.target;
            if (!target) return;

            if (target.classList.contains("supa-admin-delete-btn")) {
                event.preventDefault();
                const client = window.getSupabaseClient();
                const adminMgmtStatus = document.getElementById("adminMgmtStatus");
                if (!client) return;

                var deleteId = target.getAttribute("data-id");
                if (!confirm("Delete admin association?")) return;
                
                target.textContent = "Deleting...";
                target.style.pointerEvents = "none";
                
                try {
                    var { error } = await client.from("admins").delete().eq("id", deleteId);
                    if (error) {
                        console.error("ADMIN DELETE ERROR:", error);
                        if (adminMgmtStatus) {
                            adminMgmtStatus.textContent = "Delete failed: " + error.message;
                            adminMgmtStatus.style.color = "#ff4444";
                        }
                        target.textContent = "Delete";
                        target.style.pointerEvents = "";
                    } else {
                        target.closest("tr").remove(); 
                        if (adminMgmtStatus) {
                            adminMgmtStatus.textContent = "Admin deleted successfully.";
                            adminMgmtStatus.style.color = "#16a34a";
                        }
                    }
                } catch(err) {
                    console.error("ADMIN DELETE ERROR:", err);
                    if (adminMgmtStatus) {
                        adminMgmtStatus.textContent = "An unexpected error occurred.";
                        adminMgmtStatus.style.color = "#ff4444";
                    }
                    target.textContent = "Delete";
                    target.style.pointerEvents = "";
                } finally {
                    setTimeout(() => { if (adminMgmtStatus) adminMgmtStatus.textContent = ""; }, 5000);
                }
            }
        });
    }

    // loadSupabaseAdmins(); (Now called by authCheck)

    // Setup Logout
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const client = window.getSupabaseClient();
            if (client) {
                await client.auth.signOut();
            }
            window.location.href = '../login/';
        });
    }
});
