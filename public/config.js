// This file is served by Vercel with the static website.
window.KALID_API_URL = 'https://kalid-6r8l.onrender.com';

window.kalidApiUrl = function kalidApiUrl(path) {
    const baseUrl = window.KALID_API_URL.replace(/\/+$/, '');
    return `${baseUrl}/${String(path).replace(/^\/+/, '')}`;
};
