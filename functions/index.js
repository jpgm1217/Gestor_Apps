'use strict';

const { randomUUID } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const OpenAI = require('openai');

initializeApp();

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const ALLOWED_MODELS = new Set(['gpt-image-1', 'gpt-image-1-mini']);
const ALLOWED_QUALITIES = new Set(['low', 'medium', 'high']);
const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024']);
const DAILY_LIMIT_PER_DEVICE = 20;

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

async function validateAureaAccess(uid, accessHash) {
  const pinSnapshot = await getDatabase().ref('aurea/v1/config/pinHash').get();
  const storedPinHash = pinSnapshot.val();
  if (!storedPinHash || !accessHash || accessHash !== storedPinHash) {
    throw new HttpsError('permission-denied', 'PIN de Aurea no autorizado.');
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const usageRef = getDatabase().ref(`aurea/v1/aiUsage/${uid}/${dateKey}`);
  const transaction = await usageRef.transaction(current => {
    const used = Number(current || 0);
    if (used >= DAILY_LIMIT_PER_DEVICE) return;
    return used + 1;
  });

  if (!transaction.committed) {
    throw new HttpsError('resource-exhausted', `Límite diario de ${DAILY_LIMIT_PER_DEVICE} imágenes alcanzado.`);
  }
}

exports.generateAureaDesignImage = onCall({
  region: 'us-central1',
  timeoutSeconds: 180,
  memory: '1GiB',
  secrets: [OPENAI_API_KEY]
}, async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Se requiere una sesión anónima de Firebase.');
  }

  const prompt = cleanText(request.data?.prompt, 3000);
  const accessHash = cleanText(request.data?.accessHash, 128);
  const requestedModel = cleanText(request.data?.model, 40);
  const requestedQuality = cleanText(request.data?.quality, 15);
  const requestedSize = cleanText(request.data?.size, 20);

  if (prompt.length < 25) {
    throw new HttpsError('invalid-argument', 'El diseño necesita una descripción más completa.');
  }

  await validateAureaAccess(request.auth.uid, accessHash);

  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : 'gpt-image-1';
  const quality = ALLOWED_QUALITIES.has(requestedQuality) ? requestedQuality : 'medium';
  const size = ALLOWED_SIZES.has(requestedSize) ? requestedSize : '1024x1536';

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const result = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size,
      quality,
      output_format: 'jpeg',
      output_compression: 82
    });

    const imageBase64 = result?.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new Error('OpenAI no devolvió contenido de imagen.');
    }

    const bucket = getStorage().bucket();
    const objectPath = `aurea/generated/${request.auth.uid}/${Date.now()}-${randomUUID()}.jpg`;
    const downloadToken = randomUUID();
    const file = bucket.file(objectPath);

    await file.save(Buffer.from(imageBase64, 'base64'), {
      resumable: false,
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: downloadToken }
      }
    });

    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
    return { imageUrl, model, quality, size };
  } catch (error) {
    console.error('OpenAI image generation failed', {
      message: error?.message,
      status: error?.status,
      code: error?.code
    });

    if (error instanceof HttpsError) throw error;
    const message = cleanText(error?.message, 300) || 'No fue posible generar la imagen.';
    throw new HttpsError('internal', message);
  }
});
