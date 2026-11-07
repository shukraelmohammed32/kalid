# Kalid Barber Studio

This is the Kalid Barber Studio website with a small Neon database backend for customer booking requests.

## Run it locally

1. Create a free project at [Neon](https://neon.tech) and copy its connection string.
2. Copy `.env.example` to `.env` and paste the connection string into `DATABASE_URL`.
3. Install dependencies and create the bookings table:

   ```bash
   npm install
   npm run db:setup
   ```

4. Start the website:

   ```bash
   npm start
   ```

5. Open <http://localhost:3000>.

The booking form saves the customer's name, phone, selected service, message, status, and submission time in the `bookings` table. The API endpoint is `POST /api/bookings`, and `GET /api/health` checks the database connection.

Never put `DATABASE_URL` in browser JavaScript or commit `.env` to Git.

## Deploy the Vercel frontend with the Render API

The static website and admin page can be deployed to Vercel while the Express API runs on Render.

1. Deploy this repository to Render as a Node web service using `npm start`.
2. Set `DATABASE_URL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` on Render. Run `npm run db:setup` once with the direct Neon URL, or run `db/schema.sql` in Neon.
3. Set Render `CORS_ORIGINS` to the exact Vercel production URL. Separate multiple URLs with commas for previews or custom domains.
4. Verify the Render deployment at `https://kalid-6r8l.onrender.com/api/health`.
5. Import this repository into Vercel. It serves the static files in `public/`.
6. Set Vercel `KALID_API_URL` to `https://kalid-6r8l.onrender.com` for documentation and deployment configuration. The committed `public/config.js` uses the same production value so the browser can call the Render API.
7. Open the Vercel `/admin` URL to sign in and manage booking statuses.

The browser sends admin requests with credentials. Render therefore uses an expiring, signed `SameSite=None; Secure` HttpOnly cookie and only allows origins listed in `CORS_ORIGINS`. The password and session secret stay server-side.
