#!/usr/bin/env node
/**
 * seedFirebase.js
 *
 * Usage:
 *  - Provide a Firebase service account JSON via env var `FIREBASE_SERVICE_ACCOUNT` (stringified JSON)
 *    or place the JSON file at `functions/serviceAccountKey.json`.
 *  - Provide `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars for the admin user to create.
 *
 * Example:
 *  FIREBASE_SERVICE_ACCOUNT=$(cat serviceAccountKey.json) ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=pass node scripts/seedFirebase.js
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function loadServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch (err) {
      // maybe base64 encoded
      try {
        return JSON.parse(Buffer.from(fromEnv, 'base64').toString('utf8'));
      } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
      }
    }
  }

  const candidate = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(candidate)) {
    return require(candidate);
  }
  return null;
}

async function main() {
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.error('\nERROR: No service account JSON found.');
    console.error('Provide it via the FIREBASE_SERVICE_ACCOUNT env var or place a file at functions/serviceAccountKey.json');
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount.project_id;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });

  const auth = admin.auth();
  const db = admin.firestore();

  const adminEmail = process.env.ADMIN_EMAIL || 'dharmikrich@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'hitesh3808';

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminEmail);
      console.log('Found existing user:', userRecord.uid);
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/user-not-found') {
        console.log('Creating user', adminEmail);
        userRecord = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          emailVerified: true,
        });
        console.log('Created user:', userRecord.uid);
      } else {
        throw err;
      }
    }

    // Set custom claims (optional) so you can verify admin on server side
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    console.log('Set custom claim {admin: true} for', userRecord.uid);

    // Write roles document in Firestore  
    const rolesRef = db.collection('roles').doc(userRecord.uid);
    await rolesRef.set({ role: 'admin', email: adminEmail, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('Wrote roles/' + userRecord.uid + ' in Firestore');

    // Seed a sample property (admin can edit later via dashboard)
    try {
      const propertiesRef = db.collection('properties');
      const sampleProperty = {
        title: '2 BHK Flat',
        type: 'Flat',
        bhk: 2,
        bedrooms: 2,
        super_builtup: 656,
        area: 656,
        carpet_area: 656,
        bathrooms: 2,
        furnishing: '-',
        listed_by: 'ATOZ PROPERTIES',
        bachelors_allowed: '-',
        price: 0,
        address: 'Add address in admin',
        image_url: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const propDoc = await propertiesRef.add(sampleProperty);
      console.log('Seeded sample property with id:', propDoc.id);
    } catch (seedErr) {
      console.error('Failed to seed sample property:', seedErr.message || seedErr);
    }

    console.log('\nFirebase seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(2);
  }
}

main();
