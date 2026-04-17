// js/supabaseClient.js

const SUPABASE_URL = "https://vkartqgzceocpmadjxtv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYXJ0cWd6Y2VvY3BtYWRqeHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDM3MzYsImV4cCI6MjA5MTkxOTczNn0.7opKpj1c66G9wLloHbxPRTh59DEXHKw4ruoM8P07S5s";

// Function to safely get or initialize the client
window.getSupabaseClient = function() {
    if (!window.appSupabaseClient && window.supabase) {
        window.appSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase Client initialized successfully.");
    }
    return window.appSupabaseClient;
};

// Initial attempt to bind it to the legacy property name
window.appSupabaseClient = window.getSupabaseClient();

window.isSupabaseConfigured = function () {
    return !!window.getSupabaseClient();
};
