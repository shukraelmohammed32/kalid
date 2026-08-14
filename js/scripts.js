/*!
* Start Bootstrap - Creative v7.0.7 (https://startbootstrap.com/theme/creative)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-creative/blob/master/LICENSE)
*/
//
// Scripts
// 

window.addEventListener('DOMContentLoaded', event => {

    // Theme toggle with persisted preference
    const themeToggle = document.querySelector('[data-theme-toggle]');
    const themeLabel = themeToggle ? themeToggle.querySelector('span') : null;
    const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

    const getStoredTheme = function () {
        try {
            return window.localStorage.getItem('kalid-theme');
        } catch (error) {
            return null;
        }
    };

    const setStoredTheme = function (theme) {
        try {
            window.localStorage.setItem('kalid-theme', theme);
        } catch (error) {
            // Ignore storage errors and continue with in-memory state.
        }
    };

    const setTheme = function (theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');

        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', String(isDark));
            themeToggle.setAttribute('aria-label', isDark ? 'Enable light mode' : 'Enable dark mode');
        }

        if (themeIcon) {
            themeIcon.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
        }

        if (themeLabel) {
            themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
    };

    const savedTheme = getStoredTheme();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            setTheme(nextTheme);
            setStoredTheme(nextTheme);
        });
    }

    // Navbar shrink function
    var navbarShrink = function () {
        const navbarCollapsible = document.body.querySelector('#mainNav');
        if (!navbarCollapsible) {
            return;
        }
        if (window.scrollY === 0) {
            navbarCollapsible.classList.remove('navbar-shrink')
        } else {
            navbarCollapsible.classList.add('navbar-shrink')
        }

    };

    // Shrink the navbar 
    navbarShrink();

    // Shrink the navbar when page is scrolled
    document.addEventListener('scroll', navbarShrink);

    // Activate Bootstrap scrollspy on the main nav element
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            rootMargin: '0px 0px -40%',
        });
    };

    // Collapse responsive navbar when toggler is visible
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (navbarToggler && window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    // Activate SimpleLightbox plugin for portfolio items
    if (window.SimpleLightbox && document.querySelector('#portfolio a.portfolio-box')) {
        new SimpleLightbox({
            elements: '#portfolio a.portfolio-box'
        });
    }

    // ── Booking Form — EmailJS ────────────────────────────────────
    // HOW TO SET UP (one-time, free):
    //  1. Sign up at https://www.emailjs.com
    //  2. Add an Email Service (Gmail) → copy the Service ID below
    //  3. Create an Email Template with these variables:
    //       {{from_name}}, {{from_phone}}, {{service}}, {{message}}
    //     Set "To Email" to shukraelmohammed32@gmail.com
    //  4. Copy the Template ID below
    //  5. Go to Account → API Keys → copy your Public Key below
    // ─────────────────────────────────────────────────────────────
    const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';   // ← paste here
    const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';   // ← paste here
    const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // ← paste here

    const bookingForm = document.getElementById('bookingForm');
    const submitBtn   = document.getElementById('submitBtn');
    const feedback    = document.getElementById('formFeedback');
    const btnText     = submitBtn  ? submitBtn.querySelector('.btn-text')    : null;
    const btnSpinner  = submitBtn  ? submitBtn.querySelector('.btn-spinner') : null;

    if (bookingForm && window.emailjs) {
        emailjs.init(EMAILJS_PUBLIC_KEY);

        bookingForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Basic validation
            const name    = document.getElementById('name').value.trim();
            const phone   = document.getElementById('phone').value.trim();
            const service = document.getElementById('service').value;

            if (!name || !phone || !service || service === '') {
                showFeedback('error', 'Please fill in your name, phone, and choose a service.');
                return;
            }

            // Show loading state
            setLoading(true);
            hideFeedback();

            emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, bookingForm)
                .then(function () {
                    setLoading(false);
                    showFeedback('success', '✅ Booking request sent! We\'ll contact you shortly.');
                    bookingForm.reset();
                })
                .catch(function (error) {
                    setLoading(false);
                    console.error('EmailJS error:', error);
                    showFeedback('error', '❌ Something went wrong. Please call us at +251 93 997 5547.');
                });
        });
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        if (btnText)    btnText.classList.toggle('d-none', isLoading);
        if (btnSpinner) btnSpinner.classList.toggle('d-none', !isLoading);
    }

    function showFeedback(type, message) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.className = 'form-feedback form-feedback--' + type;
    }

    function hideFeedback() {
        if (!feedback) return;
        feedback.textContent = '';
        feedback.className = 'form-feedback';
    }

});
