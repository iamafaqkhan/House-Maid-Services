// js/bookings.js

window.insertBookingIntoSupabase = async function (payload) {
    if (!window.appSupabaseClient) {
        return { success: false, reason: "not_configured" };
    }
    try {
        const { error } = await window.appSupabaseClient
            .from("bookings")
            .insert([payload]);

        if (error) {
            console.error("Supabase booking insert failed.", error);
            return { success: false, reason: "insert_error", error: error };
        }
        return { success: true };
    } catch (error) {
        return { success: false, reason: "unexpected_error", error: error };
    }
};

// Handle booking toast via DOM
window.showToast = function (type, t, m) {
    const toast = document.getElementById('bookingToast');
    const title = document.getElementById('bookingToastTitle');
    const message = document.getElementById('bookingToastMessage');
    if (!toast || !title || !message) return;

    toast.classList.remove('success', 'error');
    toast.classList.add(type);
    title.textContent = t;
    message.textContent = m;
    toast.classList.add('show');

    setTimeout(function() {
        toast.classList.remove('show');
    }, 4500);
};

document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.getElementById('bookingToastClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            document.getElementById('bookingToast').classList.remove('show');
        });
    }

    // Index page booking form
    const bookingForm = document.querySelector('form[action="/book"][method="POST"], #bookingForm');
    if (bookingForm) {
        const bookingSubmitButton = bookingForm.querySelector('button[type="submit"]');
        bookingForm.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            
            const formData = new FormData(bookingForm);
            const bookingPayload = {
                name: (formData.get('name') || '').trim(),
                phone: (formData.get('phone') || '').trim(),
                service: (formData.get('service') || '').trim(),
                date: (formData.get('date') || '').trim(),
                time: (formData.get('time') || '').trim(),
                status: 'Pending'
            };
            const hasInvalidField = !bookingPayload.name || !bookingPayload.phone || !bookingPayload.service || !bookingPayload.date || !bookingPayload.time;

            if (bookingForm.dataset.isSubmitting === 'true') return;

            if (hasInvalidField) {
                if (window.showToast) window.showToast('error', 'Booking failed', 'Please fill in all booking fields and try again.');
                return;
            }

            bookingForm.dataset.isSubmitting = 'true';
            if (bookingSubmitButton) bookingSubmitButton.disabled = true;

            const result = await window.insertBookingIntoSupabase(bookingPayload);
            
            if (result.success) {
                if (window.showToast) window.showToast('success', 'Booking submitted', 'Thank you. We will contact you shortly.');
                bookingForm.reset();
            } else {
                if (window.showToast) window.showToast('error', 'Booking failed', 'Something went wrong. Please try again in a moment.');
            }

            setTimeout(function() {
                bookingForm.dataset.isSubmitting = 'false';
                if (bookingSubmitButton) bookingSubmitButton.disabled = false;
            }, 2000);
        });
    }
});
