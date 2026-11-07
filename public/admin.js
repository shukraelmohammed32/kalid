const loginPanel = document.getElementById('loginPanel');
const dashboardPanel = document.getElementById('dashboardPanel');
const loginForm = document.getElementById('loginForm');
const loginFeedback = document.getElementById('loginFeedback');
const dashboardFeedback = document.getElementById('dashboardFeedback');
const bookingRows = document.getElementById('bookingRows');
const emptyState = document.getElementById('emptyState');
const stats = document.getElementById('stats');
const refreshButton = document.getElementById('refreshButton');
const logoutButton = document.getElementById('logoutButton');
const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];

function showFeedback(element, message, isError = false) {
    element.textContent = message;
    element.className = `feedback${isError ? ' feedback-error' : ''}`;
}

function clearFeedback(element) {
    element.textContent = '';
    element.className = 'feedback';
}

function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value));
}

function createCell(text, className = '') {
    const cell = document.createElement('td');
    cell.textContent = text || '—';
    if (className) cell.className = className;
    return cell;
}

function renderStats(bookings) {
    const counts = statuses.reduce((result, status) => {
        result[status] = bookings.filter((booking) => booking.status === status).length;
        return result;
    }, {});

    stats.innerHTML = statuses.map((status) => `
        <div class="stat-card">
            <span>${status}</span>
            <strong>${counts[status]}</strong>
        </div>
    `).join('');
}

function renderBookings(bookings) {
    bookingRows.replaceChildren();
    emptyState.hidden = bookings.length > 0;
    renderStats(bookings);

    for (const booking of bookings) {
        const row = document.createElement('tr');
        row.append(
            createCell(booking.customer_name),
            createCell(booking.phone),
            createCell(booking.service),
            createCell(booking.message, 'message-cell'),
            createCell(formatDate(booking.created_at))
        );

        const statusCell = document.createElement('td');
        const select = document.createElement('select');
        select.className = `status status-${booking.status}`;
        select.dataset.bookingId = booking.id;
        for (const status of statuses) {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            option.selected = status === booking.status;
            select.append(option);
        }
        statusCell.append(select);
        row.append(statusCell);
        bookingRows.append(row);
    }
}

async function loadBookings() {
    clearFeedback(dashboardFeedback);
    refreshButton.disabled = true;

    try {
        const response = await fetch(window.kalidApiUrl('/api/admin/bookings'), {
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
            showLogin();
            return;
        }
        if (!response.ok) throw new Error(result.error || 'Could not load bookings.');
        renderBookings(result.bookings || []);
    } catch (error) {
        showFeedback(dashboardFeedback, error.message, true);
    } finally {
        refreshButton.disabled = false;
    }
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboardPanel.hidden = false;
    loadBookings();
}

function showLogin() {
    dashboardPanel.hidden = true;
    loginPanel.hidden = false;
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFeedback(loginFeedback);
    const button = loginForm.querySelector('button');
    button.disabled = true;

    try {
        const response = await fetch(window.kalidApiUrl('/api/admin/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: document.getElementById('password').value })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Login failed.');
        loginForm.reset();
        showDashboard();
    } catch (error) {
        showFeedback(loginFeedback, error.message, true);
    } finally {
        button.disabled = false;
    }
});

bookingRows.addEventListener('change', async (event) => {
    const select = event.target.closest('select[data-booking-id]');
    if (!select) return;
    select.disabled = true;

    try {
        const response = await fetch(window.kalidApiUrl(`/api/admin/bookings/${select.dataset.bookingId}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: select.value })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not update booking.');
        select.className = `status status-${select.value}`;
        showFeedback(dashboardFeedback, 'Booking status updated.');
        await loadBookings();
    } catch (error) {
        showFeedback(dashboardFeedback, error.message, true);
        await loadBookings();
    } finally {
        select.disabled = false;
    }
});

refreshButton.addEventListener('click', loadBookings);

logoutButton.addEventListener('click', async () => {
    await fetch(window.kalidApiUrl('/api/admin/logout'), {
        method: 'POST',
        credentials: 'include'
    });
    showLogin();
});

fetch(window.kalidApiUrl('/api/admin/session'), { credentials: 'include' })
    .then((response) => response.json())
    .then((result) => result.authenticated ? showDashboard() : showLogin())
    .catch(() => showLogin());
