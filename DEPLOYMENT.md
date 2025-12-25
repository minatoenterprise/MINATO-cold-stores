# Deploy to Render

This project uses a Render Blueprint ([render.yaml](render.yaml)) to deploy:

- Frontend: Static Site from repo root
- Backend: Node Web Service from `backend`

## Steps
1. Push the repo to GitHub.
2. In Render, New → Blueprint → select the repo.
3. Configure backend env vars:
   - `PAYSTACK_SECRET_KEY` (required)
   - `ALLOWED_ORIGINS` (set to your Static Site URL, e.g., `https://minato-frontend.onrender.com`)
   - `PORT` = `10000`
4. Update `config.js` with your backend URL:
   ```js
   window.API_BASE_URL = 'https://YOUR-BACKEND.onrender.com';
   ```
5. Redeploy the Static Site if you updated `config.js`.

## Paystack Webhook
- URL: `POST https://YOUR-BACKEND.onrender.com/api/paystack/webhook`
- Requires `PAYSTACK_SECRET_KEY` for signature verification.

## Health Check
- Backend: `GET /` → `{ ok: true, service: 'minaato-backend' }`

## CORS
- Keep `ALLOWED_ORIGINS="*"` during setup; tighten later to your exact frontend origin.