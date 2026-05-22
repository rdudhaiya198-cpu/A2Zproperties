import * as admin from "firebase-admin";

const initAdmin = () => {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return;
  }
  admin.initializeApp();
};

const withCors = (res: any) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const getBearerToken = (req: any) => {
  const authHeader = String(req.headers?.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

export default async function handler(req: any, res: any) {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    initAdmin();
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: "Missing auth token" });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const db = admin.firestore();
    const roleSnap = await db.collection("roles").doc(decoded.uid).get();
    const role = roleSnap.exists ? roleSnap.data()?.role : null;
    if (role !== "admin") {
      res.status(403).json({ ok: false, error: "Not authorized" });
      return;
    }

    const { uid } = req.body || {};
    if (!uid || typeof uid !== "string") {
      res.status(400).json({ ok: false, error: "Missing uid" });
      return;
    }
    if (uid === decoded.uid) {
      res.status(400).json({ ok: false, error: "Cannot delete yourself" });
      return;
    }

    let targetEmail: string | null = null;
    try {
      const userRecord = await admin.auth().getUser(uid);
      targetEmail = userRecord.email || null;
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") throw err;
    }

    try {
      await admin.auth().deleteUser(uid);
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") throw err;
    }

    await db.collection("roles").doc(uid).delete();
    await db.collection("admin_audit").add({
      action: "delete_user",
      admin_uid: decoded.uid,
      admin_email: decoded.email || null,
      target_uid: uid,
      target_email: targetEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
