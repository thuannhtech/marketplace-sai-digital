import { NextRequest, NextResponse } from 'next/server';
import {
  saveSubmission,
  getAllSubmissions,
  FormSubmission,
  getSubmissionFingerprint,
} from '@/src/lib/forms/storage';

export const dynamic = 'force-dynamic';

// Secret API Key validation (matches what user enters in Sitecore AI Form Webhook)
const VALID_API_KEY = process.env.SITECORE_FORMS_API_KEY || 'sai_sec_forms_2026_demo_key';
const EXPECTED_HEADER_NAME = (process.env.SITECORE_FORMS_HEADER_NAME || 'x-api-key').toLowerCase();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// In-memory fast cache to catch duplicate requests fired within milliseconds of each other
const recentFingerprints = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 30000; // 30 seconds

/**
 * Handle CORS Preflight request from Sitecore Cloud UI (app.sitecorecloud.io)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * POST /api/forms/savedata
 * Webhook endpoint for Sitecore AI / XM Cloud Forms to send & save submissions
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify API Key
    const providedApiKey =
      req.headers.get(EXPECTED_HEADER_NAME) ||
      req.headers.get('x-api-key') ||
      req.headers.get('api-key') ||
      req.headers.get('apikey') ||
      req.headers.get('x-custom-header') ||
      req.headers.get('authorization')?.replace(/bearer\s+/i, '');

    if (!providedApiKey || providedApiKey !== VALID_API_KEY) {
      console.warn(
        `[savedata] Unauthorized attempt. Received key: "${providedApiKey || 'NONE'}", expected: "${VALID_API_KEY}"`
      );
      return NextResponse.json(
        {
          isSuccessful: false,
          error: `Unauthorized: Missing or invalid API Key. Please provide Header '${EXPECTED_HEADER_NAME}' with the configured API Key.`,
        },
        {
          status: 401,
          headers: CORS_HEADERS,
        }
      );
    }

    // 2. Parse incoming payload
    const rawBody = await req.json().catch(() => ({}));

    // Explicitly delete recaptcha tokens so they are never stored
    delete rawBody['g-recaptcha-response'];
    delete rawBody['recaptcha-response'];
    delete rawBody['grecaptcha'];
    delete rawBody['__RequestVerificationToken'];

    // 3. Extract Form ID and Name dynamically
    const { searchParams } = new URL(req.url);
    const detectedFormId =
      searchParams.get('formId') ||
      searchParams.get('formid') ||
      req.headers.get('x-form-id') ||
      req.headers.get('x-formid') ||
      req.headers.get('formid') ||
      rawBody._formId ||
      rawBody.formId ||
      rawBody.FormId ||
      rawBody.form_id ||
      'sitecore-ai-form';

    const detectedFormName =
      searchParams.get('formName') ||
      searchParams.get('formname') ||
      req.headers.get('x-formname') ||
      req.headers.get('x-form-name') ||
      req.headers.get('formname') ||
      rawBody._formName ||
      rawBody.formName ||
      rawBody.FormName ||
      rawBody.form_name ||
      (detectedFormId !== 'sitecore-ai-form'
        ? `Form ${detectedFormId.substring(0, 12)}...`
        : 'Sitecore AI Form');

    const dateHeader = req.headers.get('date');
    const userAgent = req.headers.get('user-agent') || 'Sitecore Webhook Dispatcher';
    const referer =
      req.headers.get('referer') ||
      rawBody.domain ||
      req.headers.get('origin') ||
      'app.sitecorecloud.io';
    const forwardedFor =
      req.headers.get('x-forwarded-for') || req.headers.get('remote-addr') || '127.0.0.1';

    // 4. In-Memory Fast Deduplication Guard (catches sub-second duplicate requests from dual webhooks or retries)
    const fingerprint = getSubmissionFingerprint(detectedFormId, rawBody);
    const now = Date.now();
    const lastSeen = recentFingerprints.get(fingerprint);

    if (lastSeen && now - lastSeen < DEDUPLICATION_WINDOW_MS) {
      console.log(`[savedata] Fast in-memory deduplication triggered for: ${fingerprint}`);
      return NextResponse.json(
        {
          isSuccessful: true,
          message: 'Duplicate submission detected; deduplicated.',
          receivedData: {
            formName: detectedFormName,
            formId: detectedFormId,
            fieldsCount: Object.keys(rawBody).length,
          },
        },
        {
          status: 200,
          headers: CORS_HEADERS,
        }
      );
    }
    recentFingerprints.set(fingerprint, now);

    // Garbage collection of old fingerprints
    if (recentFingerprints.size > 200) {
      for (const [k, v] of recentFingerprints.entries()) {
        if (now - v > DEDUPLICATION_WINDOW_MS) recentFingerprints.delete(k);
      }
    }

    // 5. Save submission into storage (storage.ts also executes secondary deduplication against persisted records)
    const newSubmission: FormSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      formId: detectedFormId,
      formName: detectedFormName,
      submittedAt:
        dateHeader && !isNaN(Date.parse(dateHeader))
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString(),
      pageUrl: referer,
      data: rawBody,
      metadata: {
        userAgent,
        ip: forwardedFor,
        domain: rawBody.domain || referer,
        apiKeyUsed: providedApiKey ? `${providedApiKey.substring(0, 7)}...` : undefined,
        source: 'Sitecore AI Cloud Webhook (API Key Validated)',
        status: 'new',
      },
    };

    await saveSubmission(newSubmission);

    return NextResponse.json(
      {
        isSuccessful: true,
        message: 'Submission successfully received and stored.',
        submissionId: newSubmission.id,
        receivedData: {
          formName: detectedFormName,
          formId: detectedFormId,
          fieldsCount: Object.keys(rawBody).length,
        },
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error: any) {
    console.error('Error in /api/forms/savedata:', error);
    return NextResponse.json(
      {
        isSuccessful: false,
        error: error.message || 'Internal server error while processing webhook data',
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}
