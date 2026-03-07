This folder contains a minimal skeleton for server-side endpoints (Cloud Functions / Express) used for booking validation, Stripe payments, and admin-only confirmation flows.

Notes:
- Install dependencies: `npm install` in the `functions` folder.
- Replace placeholders with real `firebase-admin` service account initialization and Stripe secret keys.
- Deploy these endpoints as Cloud Functions, Cloud Run, or any server hosting provider.

Endpoints:
- `POST /createBooking` - validate booking limits and create a booking (server-side transaction recommended).
- `POST /confirmBooking` - admin-only endpoint to confirm bookings and create calendar events or ICS attachments.
- `POST /createPaymentIntent` - create Stripe PaymentIntent and return `client_secret`.
 - `POST /uploadImage` - upload multipart/form-data image (field `image`) to Cloudinary and return `secure_url` + metadata.
 - `POST /uploadBase64` - upload base64-encoded image JSON payload to Cloudinary.

Cloudinary setup
----------------

This project already contains an Express endpoint that uploads images to Cloudinary. To enable it you must set these environment variables in the `functions` environment (locally or in your hosting platform):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Example (Windows PowerShell):

```powershell
$env:CLOUDINARY_CLOUD_NAME = 'your_cloud_name'
$env:CLOUDINARY_API_KEY = 'your_api_key'
$env:CLOUDINARY_API_SECRET = 'your_api_secret'
npm start
```

If you prefer to avoid environment variables during local testing you can create a `.env` loader or set the variables in your shell, but DO NOT commit secrets into source control.

Seeding helper
---------------

Use `scripts/seedFirebase.js` to create an admin user and a Firestore `roles/{uid}` document.

You must provide a Firebase service account JSON. Options:

- Set the environment variable `FIREBASE_SERVICE_ACCOUNT` to the JSON string (raw or base64-encoded).
- Or place the service account JSON file at `functions/serviceAccountKey.json`.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars if you want different admin credentials. Defaults are:

- ADMIN_EMAIL: `dharmikrich@gmail.com`
- ADMIN_PASSWORD: `hitesh3808`

Example (Linux/macOS):

```bash
FIREBASE_SERVICE_ACCOUNT=$(cat serviceAccountKey.json) ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=strongpass node scripts/seedFirebase.js
```

Example (Windows PowerShell):

```powershell
$svc = Get-Content .\\serviceAccountKey.json -Raw
$env:FIREBASE_SERVICE_ACCOUNT = $svc
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "strongpass"
node scripts/seedFirebase.js
```
