// js/auth.js

// Auth API Methods
window.signInAdminWithSupabase = async function (email, password) {
    if (!window.appSupabaseClient) return { success: false, reason: "not_configured" };
    try {
        const { data, error } = await window.appSupabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) return { success: false, reason: "auth_error", error: error };
        return { success: true, data: data };
    } catch (error) {
        return { success: false, reason: "unexpected_error", error: error };
    }
};

window.getSupabaseSession = async function () {
    if (!window.appSupabaseClient) return { success: false, reason: "not_configured", session: null };
    try {
        const { data, error } = await window.appSupabaseClient.auth.getSession();
        if (error) return { success: false, reason: "session_error", error: error, session: null };
        return { success: true, session: data.session };
    } catch (error) {
        return { success: false, reason: "unexpected_error", error: error, session: null };
    }
};

// Handle login page events
document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector('form[action="/admin"][method="POST"], #loginForm');
    if (!form) return;

    var emailInput = form.querySelector('input[name="email"]');
    var passwordInput = form.querySelector('input[name="password"]');
    var submitButton  = form.querySelector('button[type="submit"]');

    var statusNode = document.createElement("p");
    statusNode.id = "loginStatus";
    statusNode.style.cssText = "color:#8A1538;font-size:14px;margin-top:12px;min-height:20px;";
    form.appendChild(statusNode);

    // Initial session redirect
    if (window.isSupabaseConfigured()) {
        window.getSupabaseSession().then(function (res) {
            if (res.success && res.session) {
                window.location.href = "../admin/";
            }
        });
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault(); // Stop normal POST

        var emailValue = (emailInput && emailInput.value || "").trim();
        var passwordValue = (passwordInput && passwordInput.value || "").trim();

        if (!window.isSupabaseConfigured()) {
            statusNode.textContent = "Supabase configuration is missing.";
            return;
        }
        if (!passwordValue) {
            statusNode.textContent = "Please enter your password.";
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Signing in...";
        }
        statusNode.textContent = "Authenticating with Supabase...";

        try {
            var result = await window.signInAdminWithSupabase(emailValue, passwordValue);
            if (!result || !result.success) {
                var reason = result?.error?.message || "Invalid email or password.";
                statusNode.textContent = "Login failed: " + reason;
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "Login";
                }
                return;
            }

            statusNode.style.color = "#16a34a";
            statusNode.textContent = "Login successful! Redirecting...";
            window.location.href = "../admin/";
        } catch (err) {
            statusNode.textContent = "Unexpected error. Please try again.";
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Login";
            }
        }
    });
});
