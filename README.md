# Minaato Cold Store Website

A simple online shop for Minaato Cold Store (Afari) with WhatsApp ordering, a cart, and a checkout page.

## Features
- Product catalog with GHS prices
- Add to Cart and Cart page (localStorage)
- Checkout form that composes a WhatsApp order message
- "Order Now" buttons that open WhatsApp with pre-filled messages
- Delivery information section

## Configure WhatsApp Number
Edit `shop.js` and set your WhatsApp number:

```js
const WHATSAPP_NUMBER = '233XXXXXXXXX'; // no leading +
```

## Local Testing
Open `INDEX.HTML` in your browser. All pages are static.

## Deploy on Render (Static Site)
1. Push this folder to a Git repository (GitHub recommended).
2. Create a new **Static Site** on Render.
3. Connect your repository.
4. Set **Build Command**: (leave empty)
5. Set **Publish Directory**: `/` (root)
6. Render will serve the site at your chosen URL.

Optionally, you can use a simple Node server, but this project is designed for static hosting.

## Notes
- Prices are sample values. Update them in `PRODUCTS.HTML`.
- Cart uses browser storage; clearing site data resets it.
- For payments, integrate a provider later (e.g., Paystack), then post orders to a backend.

## Backend (Web Service) on Render
This repo includes a minimal Node/Express backend in `backend/` to record orders and start Paystack payments.

### Configure and run locally

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and set PAYSTACK_SECRET_KEY and ALLOWED_ORIGINS
npm start
```

Backend endpoints:
- POST `/api/orders` → create an order record
- GET `/api/orders/:id` → fetch order
- POST `/api/paystack/initialize` → returns `authorization_url` to redirect
- POST `/api/paystack/webhook` → mark order paid (set this URL in Paystack dashboard)

### Deploy on Render
1. Create a new **Web Service** from the `backend/` folder.
2. Environment Variables:
	- `PAYSTACK_SECRET_KEY`: your Paystack secret key
	- `PORT`: `10000` (or any)
	- `ALLOWED_ORIGINS`: your static site URL (comma-separated)
3. Start Command: `npm start`

Front-end Checkout has a “Pay with Card” button that calls the backend.
If the backend isn’t reachable, it falls back to WhatsApp/Email.

## Security Hardening (when you tighten access)

- CORS: set `ALLOWED_ORIGINS` to your exact frontend domain (e.g., `https://minaato.onrender.com`). Avoid `*` in production. Multiple origins can be comma-separated.
- Rate limiting: add request limits to protect the Paystack initialize endpoint and general API.
- Logging: enable structured request/response logging for troubleshooting and audits.
- Secrets: store `PAYSTACK_SECRET_KEY` only in environment variables; never commit it.
- Webhook verification: ensure the Paystack webhook checks the `x-paystack-signature` (already implemented) and only updates orders when verified.
- HTTPS: use HTTPS for both frontend and backend on Render; avoid serving over plain HTTP.
- Validation: validate input on `/api/orders` (name, phone, items) and sanitize user-provided strings.

Suggested additions (backend):

```bash
cd backend
npm install express-rate-limit morgan
```

```js
// server.js (top-level after express.json())
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

app.use(morgan('combined'));

const limiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 60,             // 60 requests per minute per IP
});
app.use(limiter);

// Optionally apply stricter limits to payment init
const payLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.post('/api/paystack/initialize', payLimiter, /* handler */);
```

When ready, redeploy the backend with updated dependencies and environment settings.
