import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, timingSafeEqual } from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load local development secrets when present. Vercel injects its own
// environment variables at runtime, and dotenv will not overwrite them.
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const databaseReady = sql
    ? Promise.all([
        sql`
            CREATE TABLE IF NOT EXISTS bookings (
                id BIGSERIAL PRIMARY KEY,
                customer_name VARCHAR(100) NOT NULL,
                phone VARCHAR(30) NOT NULL,
                service VARCHAR(100) NOT NULL,
                message TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `,
        sql`CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC)`
    ])
    : Promise.resolve();
const adminCookieName = 'kalid_admin_session';
const adminSessionTtlMs = 8 * 60 * 60 * 1000;
const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled']);
const allowedServices = new Set([
    'Haircut & Styling',
    'Beard Sculpting',
    'Signature Package',
    'Complete Package'
]);

app.use(express.json({ limit: '10kb' }));

function getAllowedOrigins() {
    return String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

app.use((req, res, next) => {
    const origin = String(req.headers.origin || '').replace(/\/+$/, '');
    const allowedOrigins = getAllowedOrigins();

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
        return origin && allowedOrigins.includes(origin)
            ? res.sendStatus(204)
            : res.sendStatus(403);
    }

    return next();
});

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));

    return leftBuffer.length === rightBuffer.length
        && timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminSession() {
    const issuedAt = String(Date.now());
    const signature = createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
        .update(issuedAt)
        .digest('base64url');

    return `${issuedAt}.${signature}`;
}

function getAdminSession(req) {
    const cookies = String(req.headers.cookie || '')
        .split(';')
        .map((cookie) => cookie.trim());
    const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${adminCookieName}=`));

    if (!sessionCookie || !process.env.ADMIN_SESSION_SECRET) {
        return null;
    }

    const token = sessionCookie.slice(`${adminCookieName}=`.length);
    const [issuedAt, signature] = token.split('.');
    const issuedAtMs = Number(issuedAt);

    if (!issuedAt || !signature || !Number.isFinite(issuedAtMs)) {
        return null;
    }

    if (Date.now() - issuedAtMs > adminSessionTtlMs || issuedAtMs > Date.now() + 60_000) {
        return null;
    }

    const expectedSignature = createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
        .update(issuedAt)
        .digest('base64url');

    return safeEqual(signature, expectedSignature) ? { issuedAt: issuedAtMs } : null;
}

function adminIsConfigured() {
    return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

function requireAdmin(req, res, next) {
    if (!adminIsConfigured()) {
        return res.status(503).json({ ok: false, error: 'Admin access is not configured.' });
    }

    if (!getAdminSession(req)) {
        return res.status(401).json({ ok: false, error: 'Admin login required.' });
    }

    return next();
}

app.get('/api/health', async (_req, res) => {
    if (!sql) {
        return res.status(503).json({ ok: false, error: 'DATABASE_URL is not configured.' });
    }

    try {
        await databaseReady;
        await sql`SELECT 1`;
        return res.json({ ok: true });
    } catch (error) {
        console.error('Database health check failed:', error);
        return res.status(503).json({ ok: false, error: 'Database is unavailable.' });
    }
});

app.post('/api/bookings', async (req, res) => {
    if (!sql) {
        return res.status(503).json({ ok: false, error: 'Database is not configured yet.' });
    }

    const name = String(req.body?.from_name || '').trim();
    const phone = String(req.body?.from_phone || '').trim();
    const service = String(req.body?.service || '').trim();
    const message = String(req.body?.message || '').trim();

    if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ ok: false, error: 'Please enter a valid name.' });
    }

    if (phone.length < 7 || phone.length > 30) {
        return res.status(400).json({ ok: false, error: 'Please enter a valid phone number.' });
    }

    if (!allowedServices.has(service)) {
        return res.status(400).json({ ok: false, error: 'Please choose a valid service.' });
    }

    if (message.length > 1000) {
        return res.status(400).json({ ok: false, error: 'Your message is too long.' });
    }

    try {
        await databaseReady;
        const [booking] = await sql`
            INSERT INTO bookings (customer_name, phone, service, message)
            VALUES (${name}, ${phone}, ${service}, ${message || null})
            RETURNING id, created_at
        `;

        return res.status(201).json({
            ok: true,
            bookingId: booking.id,
            createdAt: booking.created_at
        });
    } catch (error) {
        console.error('Booking insert failed:', error);
        return res.status(500).json({ ok: false, error: 'Could not save the booking.' });
    }
});

app.post('/api/admin/login', (req, res) => {
    if (!adminIsConfigured()) {
        return res.status(503).json({ ok: false, error: 'Admin access is not configured.' });
    }

    const password = String(req.body?.password || '');

    if (!safeEqual(password, process.env.ADMIN_PASSWORD)) {
        return res.status(401).json({ ok: false, error: 'Incorrect admin password.' });
    }

    const secureCookie = process.env.COOKIE_SECURE !== 'false'
        && (process.env.VERCEL
            || process.env.RENDER
            || process.env.RENDER_EXTERNAL_URL
            || process.env.NODE_ENV === 'production');
    const cookieParts = [
        `${adminCookieName}=${createAdminSession()}`,
        'HttpOnly',
        'SameSite=None',
        'Path=/',
        `Max-Age=${adminSessionTtlMs / 1000}`
    ];

    if (secureCookie) {
        cookieParts.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
    res.setHeader('Set-Cookie', `${adminCookieName}=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0`);
    return res.json({ ok: true });
});

app.get('/api/admin/session', (req, res) => {
    if (!adminIsConfigured()) {
        return res.status(503).json({ ok: false, authenticated: false, error: 'Admin access is not configured.' });
    }

    return res.json({ ok: true, authenticated: Boolean(getAdminSession(req)) });
});

app.get('/api/admin/bookings', requireAdmin, async (_req, res) => {
    if (!sql) {
        return res.status(503).json({ ok: false, error: 'Database is not configured yet.' });
    }

    try {
        await databaseReady;
        const bookings = await sql`
            SELECT id, customer_name, phone, service, message, status, created_at
            FROM bookings
            ORDER BY created_at DESC
            LIMIT 500
        `;

        return res.json({ ok: true, bookings });
    } catch (error) {
        console.error('Admin booking list failed:', error);
        return res.status(500).json({ ok: false, error: 'Could not load bookings.' });
    }
});

app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
    if (!sql) {
        return res.status(503).json({ ok: false, error: 'Database is not configured yet.' });
    }

    const id = Number.parseInt(req.params.id, 10);
    const status = String(req.body?.status || '').trim();

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ ok: false, error: 'Invalid booking ID.' });
    }

    if (!allowedStatuses.has(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid booking status.' });
    }

    try {
        await databaseReady;
        const [booking] = await sql`
            UPDATE bookings
            SET status = ${status}
            WHERE id = ${id}
            RETURNING id, customer_name, phone, service, message, status, created_at
        `;

        if (!booking) {
            return res.status(404).json({ ok: false, error: 'Booking not found.' });
        }

        return res.json({ ok: true, booking });
    } catch (error) {
        console.error('Admin booking update failed:', error);
        return res.status(500).json({ ok: false, error: 'Could not update booking.' });
    }
});

// Friendly admin URL for both local development and Vercel deployments.
app.get('/admin', (_req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Vercel serves files from /public through its CDN. This middleware keeps the
// same static-file behavior when running locally with `npm start`.
app.use(express.static(path.join(__dirname, 'public')));

// Vercel imports the Express app as a serverless function. Start a local
// listener only when running outside Vercel.
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Kalid Barber Studio running at http://localhost:${port}`);
        if (!sql) {
            console.warn('DATABASE_URL is missing. Add it to .env before saving bookings.');
        }
    });
}

export default app;
