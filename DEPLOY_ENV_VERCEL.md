**Vercel Environment Setup**

- Recommended: set environment variables in the Vercel dashboard or via `vercel` CLI. Do NOT commit real secrets to the repo.

1) Dashboard (UI)
  - Open your project on Vercel.
  - Settings → Environment Variables → Add each variable (use names from `.env.production.example`).
  - For values, paste the secret values and set the Environment to `Production` (and `Preview` if desired).

2) Using Vercel CLI (quick):
  - Install CLI: `npm i -g vercel`
  - Login: `vercel login`
  - Add variables:
    ```bash
    vercel env add VITE_FIREBASE_API_KEY production
    vercel env add VITE_FIREBASE_AUTH_DOMAIN production
    vercel env add VITE_FIREBASE_PROJECT_ID production
    vercel env add VITE_FIREBASE_STORAGE_BUCKET production
    vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
    vercel env add VITE_FIREBASE_APP_ID production

    vercel env add VITE_CLOUDINARY_CLOUD_NAME production
    vercel env add VITE_CLOUDINARY_UNSIGNED_UPLOAD_PRESET production

    # optional
    vercel env add VITE_FUNCTIONS_URL production
    ```
  - The CLI will prompt for the secret value for each variable.

3) After adding env vars, redeploy the project on Vercel.

Notes:
- For Cloudinary unsigned uploads create an unsigned preset in Cloudinary dashboard and use its name as `VITE_CLOUDINARY_UNSIGNED_UPLOAD_PRESET`.
- If you prefer Firebase Storage uploads, set CORS on your bucket (see `cors.json`), or route uploads through the functions endpoint and set `VITE_FUNCTIONS_URL` to your deployed function.
