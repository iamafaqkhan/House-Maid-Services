// ADD BELOW THIS LINE - Browser Supabase client module
(function () {
    const config = window.SUPABASE_CONFIG || {};
    const url = config.url || "";
    const anonKey = config.anonKey || "";
    const hasTemplateValues = url.includes("{{") || anonKey.includes("{{");

    window.appSupabaseClient = window.supabase && url && anonKey && !hasTemplateValues
        ? window.supabase.createClient(url, anonKey)
        : null;

    window.insertBookingIntoSupabase = async function (payload) {
        if (!window.appSupabaseClient) {
            console.warn("Supabase client is not configured for the browser.");
            return;
        }

        try {
            const { error } = await window.appSupabaseClient
                .from("bookings")
                .insert([payload]);

            if (error) {
                console.error("Supabase booking insert failed.", error);
            }
        } catch (error) {
            console.error("Supabase booking insert crashed.", error);
        }
    };
})();
