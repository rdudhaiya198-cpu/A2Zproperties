import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import stream from 'stream';

// Try to initialize firebase-admin. In production (Cloud Functions) Application Default
// credentials will be used. For local testing you can set GOOGLE_APPLICATION_CREDENTIALS
// or place a serviceAccountKey.json next to this file.
try {
  if (!admin.apps.length) {
    try {
      admin.initializeApp();
      console.log('Initialized firebase-admin with application default credentials');
    } catch (e) {
      // fallback to local service account if present
      const saPath = path.join(__dirname, 'serviceAccountKey.json');
      if (fs.existsSync(saPath)) {
        const serviceAccount = require(saPath);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('Initialized firebase-admin with local service account');
      } else {
        console.warn('firebase-admin not initialized: no credentials found');
      }
    }
  }
} catch (err) {
  console.warn('Failed to initialize firebase-admin', err);
}

const app = express();
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Create booking - validate limits server-side (skeleton)
app.post('/createBooking', async (req, res) => {
  const { userId, properties, slot } = req.body;
  // TODO: validate MAX_PROPERTIES_PER_VISIT (3), slot capacity using Firestore transaction
  // TODO: write booking with status 'pending'
  res.json({ ok: true, bookingId: 'bk_placeholder' });
});

// Confirm booking - admin only (skeleton)
app.post('/confirmBooking', async (req, res) => {
  const { bookingId } = req.body;
  // TODO: verify admin (via Firebase Auth token / roles), set booking.status='confirmed'
  // TODO: create Google Calendar event or generate ICS and attach to booking
  res.json({ ok: true });
});

// Create payment intent (Stripe) - skeleton
app.post('/createPaymentIntent', async (req, res) => {
  const { amount, currency = 'inr' } = req.body;
  // TODO: create Stripe PaymentIntent and return client_secret
  res.json({ ok: true, client_secret: 'pi_placeholder' });
});

// Send push notification to admins using stored FCM tokens
app.post('/sendNotification', async (req, res) => {
  const { type, refId, title, message, data = {} } = req.body || {};
  if (!admin.apps.length) return res.status(500).json({ ok: false, error: 'firebase-admin not initialized' });
  try {
    const db = admin.firestore();
    const snap = await db.collection('fcm_tokens').where('role', '==', 'admin').get();
    const tokens: string[] = [];
    snap.forEach((d) => {
      const t = d.data()?.token;
      if (t) tokens.push(t);
    });
    if (tokens.length === 0) return res.json({ ok: true, sent: 0 });

    const payload: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: title || (type === 'booking' ? 'New Booking' : 'Notification'),
        body: message || '',
      },
      data: { type: String(type || ''), refId: String(refId || ''), ...Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])) },
    };

    const result = await admin.messaging().sendMulticast(payload);

    // cleanup invalid tokens
    const invalidTokens: string[] = [];
    result.responses.forEach((r, i) => {
      if (!r.success) {
        const err = r.error as any;
        if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
          invalidTokens.push(tokens[i]);
        }
      }
    });
    for (const t of invalidTokens) {
      try { await db.collection('fcm_tokens').doc(t).delete(); } catch (e) { /* ignore */ }
    }

    return res.json({ ok: true, success: result.successCount, failure: result.failureCount });
  } catch (err) {
    console.error('sendNotification error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Cloudinary upload endpoint
// Configure Cloudinary using environment variables:
// - CLOUDINARY_CLOUD_NAME
// - CLOUDINARY_API_KEY
// - CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

const uploadFromBuffer = (buffer: Buffer, options: any = {}) =>
  new Promise<any>((resolve, reject) => {
    const passthrough = new stream.PassThrough();
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });

// Accepts multipart/form-data with field `image` and optional metadata fields
app.post('/uploadImage', upload.single('image'), async (req, res) => {
  try {
    // diagnostics
    console.log('uploadImage: headers', { 'content-length': req.headers['content-length'], 'content-type': req.headers['content-type'] });

    const file = (req as any).file || (req as any).files?.image;
    if (!file || !file.buffer) {
      console.warn('uploadImage: no file received by multer');
      return res.status(400).json({ ok: false, error: 'No file uploaded. Ensure you send multipart/form-data with field "image".' });
    }

    // Check Cloudinary config
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary not configured in environment');
      return res.status(500).json({ ok: false, error: 'Cloudinary not configured on server' });
    }

    // optional metadata from form
    const { title, description, propertyId, uploadedBy } = req.body || {};

    console.log('uploadImage: file received, size', file.buffer?.length);
    const result = await uploadFromBuffer(file.buffer, { resource_type: 'image', folder: 'properties' });

    const imageRecord: any = {
      public_id: result?.public_id,
      url: result?.secure_url || result?.url,
      width: result?.width,
      height: result?.height,
      format: result?.format,
      bytes: result?.bytes,
      created_at: admin.firestore ? admin.firestore.Timestamp.now() : new Date().toISOString(),
      title: title || null,
      description: description || null,
      propertyId: propertyId || null,
      uploadedBy: uploadedBy || null,
    };

    // Save metadata to Firestore only if explicitly enabled
    if (process.env.SAVE_IMAGE_METADATA === 'true' && admin.apps.length) {
      try {
        const db = admin.firestore();
        await db.collection('images').add(imageRecord);
      } catch (e) {
        console.warn('Failed to save image metadata to Firestore', e);
      }
    }

    return res.json({ ok: true, secure_url: result?.secure_url || result?.url, public_id: result?.public_id, image: imageRecord });
  } catch (err) {
    console.error('uploadImage error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Fallback endpoint: accepts JSON { data: 'data:image/png;base64,...', title?, propertyId? }
app.post('/uploadBase64', async (req, res) => {
  try {
    const { data, title, description, propertyId, uploadedBy } = req.body || {};
    if (!data || typeof data !== 'string') return res.status(400).json({ ok: false, error: 'Missing base64 data' });

    const m = data.match(/^data:(image\/.+);base64,(.+)$/);
    const base64 = m ? m[2] : data;
    const buffer = Buffer.from(base64, 'base64');

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary not configured in environment');
      return res.status(500).json({ ok: false, error: 'Cloudinary not configured on server' });
    }

    const result = await uploadFromBuffer(buffer, { resource_type: 'image', folder: 'properties' });

    const imageRecord: any = {
      public_id: result?.public_id,
      url: result?.secure_url || result?.url,
      width: result?.width,
      height: result?.height,
      format: result?.format,
      bytes: result?.bytes,
      created_at: admin.firestore ? admin.firestore.Timestamp.now() : new Date().toISOString(),
      title: title || null,
      description: description || null,
      propertyId: propertyId || null,
      uploadedBy: uploadedBy || null,
    };

    if (process.env.SAVE_IMAGE_METADATA === 'true' && admin.apps.length) {
      try {
        const db = admin.firestore();
        await db.collection('images').add(imageRecord);
      } catch (e) {
        console.warn('Failed to save image metadata to Firestore', e);
      }
    }

    return res.json({ ok: true, secure_url: result?.secure_url || result?.url, public_id: result?.public_id, image: imageRecord });
  } catch (err) {
    console.error('uploadBase64 error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});