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
const AUREA_ALLOWED_EMAILS = defineSecret('AUREA_ALLOWED_EMAILS');
const ALLOWED_MODELS = new Set(['gpt-5.6']);
const ALLOWED_QUALITIES = new Set(['low', 'medium', 'high']);
const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024']);
const DAILY_LIMIT_PER_ACCOUNT = 20;
const MAX_IMAGE_DATA_LENGTH = 2_500_000;

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanImageDataUrl(value) {
  const dataUrl = String(value || '');
  if (!dataUrl) return '';
  if (dataUrl.length > MAX_IMAGE_DATA_LENGTH) {
    throw new HttpsError('invalid-argument', 'Una imagen de referencia es demasiado pesada.');
  }
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    throw new HttpsError('invalid-argument', 'Formato de imagen de referencia no permitido.');
  }
  return dataUrl;
}

function cleanGeneratedImageUrl(value, uid) {
  const url = cleanText(value, 2000);
  if (!url) return '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new HttpsError('invalid-argument', 'La imagen para editar no tiene una URL válida.');
  }
  const bucketName = getStorage().bucket().name;
  const expectedPath = `/v0/b/${bucketName}/o/aurea%2Fgenerated%2F${encodeURIComponent(uid)}%2F`;
  if (parsed.protocol !== 'https:'
    || parsed.hostname !== 'firebasestorage.googleapis.com'
    || !parsed.pathname.startsWith(expectedPath)) {
    throw new HttpsError('invalid-argument', 'La imagen para editar no pertenece a Aurea.');
  }
  return url;
}

function imageTool(quality, size, action) {
  return {
    type: 'image_generation',
    action,
    model: 'gpt-image-2',
    quality,
    size,
    background: 'opaque',
    output_format: 'jpeg',
    output_compression: 82
  };
}

function imageFromResponse(response) {
  if (response?.status && response.status !== 'completed') {
    const responseError = new Error('La generación de OpenAI no terminó correctamente.');
    responseError.code = response?.error?.code || response?.incomplete_details?.reason || 'response_incomplete';
    throw responseError;
  }
  const call = response?.output?.find(output => output.type === 'image_generation_call');
  if (!call?.result || (call.status && call.status !== 'completed')) {
    const imageError = new Error('OpenAI no devolvió contenido de imagen.');
    imageError.code = call?.status === 'failed' ? 'image_generation_failed' : 'image_generation_incomplete';
    throw imageError;
  }
  return call.result;
}

function firstTurnInput(prompt, productImageData, styleReferenceImages) {
  const content = [{ type: 'input_text', text: prompt }];
  if (productImageData) content.push({ type: 'input_image', image_url: productImageData, detail: 'auto' });
  styleReferenceImages.forEach(imageUrl => content.push({ type: 'input_image', image_url: imageUrl, detail: 'auto' }));
  return [{ role: 'user', content }];
}

async function reserveAureaUsage(uid, email, emailVerified) {
  const allowedEmails = new Set(
    AUREA_ALLOWED_EMAILS.value()
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)
  );
  if (!emailVerified || !email || !allowedEmails.has(String(email).toLowerCase())) {
    throw new HttpsError('permission-denied', 'La cuenta de Google no está autorizada para Aurea.');
  }

  const dateKey = new Date().toISOString().slice(0, 10);
  const usageRef = getDatabase().ref(`aurea/v1/aiUsage/${uid}/${dateKey}`);
  const transaction = await usageRef.transaction(current => {
    const used = Number(current || 0);
    if (used >= DAILY_LIMIT_PER_ACCOUNT) return;
    return used + 1;
  });

  if (!transaction.committed) {
    throw new HttpsError('resource-exhausted', `Límite diario de ${DAILY_LIMIT_PER_ACCOUNT} imágenes alcanzado.`);
  }
  return usageRef;
}

async function releaseAureaUsage(usageRef) {
  if (!usageRef) return;
  try {
    await usageRef.transaction(current => Math.max(0, Number(current || 0) - 1));
  } catch (error) {
    console.warn('Could not release Aurea AI usage reservation', { message: error?.message });
  }
}

function canRetryFromImage(error) {
  const status = Number(error?.status || 0);
  const description = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  return [400, 404].includes(status)
    && description.includes('response')
    && /(invalid|not found|expired|unknown)/.test(description);
}

exports.generateAureaDesignImage = onCall({
  region: 'us-central1',
  timeoutSeconds: 240,
  memory: '1GiB',
  enforceAppCheck: true,
  secrets: [OPENAI_API_KEY, AUREA_ALLOWED_EMAILS]
}, async request => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Se requiere una cuenta de Google autorizada.');
  }

  const prompt = cleanText(request.data?.prompt, 3000);
  const feedback = cleanText(request.data?.feedback, 1200);
  const previousResponseId = cleanText(request.data?.previousResponseId, 200);
  const productImageData = cleanImageDataUrl(request.data?.productImageData);
  const styleReferenceImages = Array.isArray(request.data?.styleReferenceImages)
    ? request.data.styleReferenceImages.slice(0, 4).map(cleanImageDataUrl).filter(Boolean)
    : [];
  const currentImageUrl = cleanGeneratedImageUrl(request.data?.currentImageUrl, request.auth.uid);
  const requestedModel = cleanText(request.data?.model, 40);
  const requestedQuality = cleanText(request.data?.quality, 15);
  const requestedSize = cleanText(request.data?.size, 20);

  if (prompt.length < 25) {
    throw new HttpsError('invalid-argument', 'El diseño necesita una descripción más completa.');
  }

  const usageRef = await reserveAureaUsage(
    request.auth.uid,
    request.auth.token?.email,
    request.auth.token?.email_verified === true
  );

  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : 'gpt-5.6';
  const quality = ALLOWED_QUALITIES.has(requestedQuality) ? requestedQuality : 'medium';
  const size = ALLOWED_SIZES.has(requestedSize) ? requestedSize : '1024x1536';

  try {
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY.value(),
      timeout: 200_000,
      maxRetries: 0
    });
    const safetyIdentifier = `aurea_${request.auth.uid}`;
    let response;

    if (feedback && (previousResponseId || currentImageUrl)) {
      const refinement = `Edita la imagen anterior aplicando este cambio solicitado por la persona usuaria: ${feedback}

Mantén el producto como protagonista y conserva todos los elementos que no se pidieron cambiar. No generes texto, logotipos, números, iconos, sellos ni marcas de agua. Conserva espacios limpios arriba y abajo para la plantilla de Aurea.`;
      if (previousResponseId) {
        try {
          response = await openai.responses.create({
            model,
            previous_response_id: previousResponseId,
            input: refinement,
            tools: [imageTool(quality, size, 'edit')],
            safety_identifier: safetyIdentifier,
            store: true
          });
        } catch (continuationError) {
          if (!currentImageUrl || !canRetryFromImage(continuationError)) throw continuationError;
          console.warn('Aurea response continuation failed; retrying from generated image', {
            code: continuationError?.code,
            status: continuationError?.status,
            requestId: continuationError?.request_id
          });
        }
      }
      if (!response) {
        response = await openai.responses.create({
          model,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: refinement },
              { type: 'input_image', image_url: currentImageUrl, detail: 'auto' }
            ]
          }],
          tools: [imageTool(quality, size, 'edit')],
          safety_identifier: safetyIdentifier,
          store: true
        });
      }
    } else {
      response = await openai.responses.create({
        model,
        input: firstTurnInput(prompt, productImageData, styleReferenceImages),
        tools: [imageTool(quality, size, 'generate')],
        safety_identifier: safetyIdentifier,
        store: true
      });
    }

    const imageBase64 = imageFromResponse(response);
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
    return { imageUrl, responseId: response.id, model, quality, size };
  } catch (error) {
    console.error('OpenAI image generation failed', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      requestId: error?.request_id,
      moderationDetails: error?.moderation_details
    });

    await releaseAureaUsage(usageRef);
    if (error instanceof HttpsError) throw error;
    if (['moderation_blocked', 'invalid_prompt', 'image_content_policy_violation'].includes(error?.code)) {
      throw new HttpsError('invalid-argument', 'La solicitud no pudo procesarse. Cambia la instrucción y vuelve a intentar.');
    }
    throw new HttpsError('internal', 'No fue posible generar la imagen de Aurea.', {
      providerCode: cleanText(error?.code, 80) || 'unknown'
    });
  }
});
