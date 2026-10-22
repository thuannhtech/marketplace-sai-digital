import { NextRequest, NextResponse } from 'next/server';
import { saveSubmission, FormSubmission } from '@/src/lib/forms/storage';

export const dynamic = 'force-dynamic';

// Secret API Key validation (matches what user enters in Sitecore AI Form Webhook)
const VALID_API_KEY = process.env.SITECORE_FORMS_API_KEY || 'sai_sec_forms_2026_demo_key';
const EXPECTED_HEADER_NAME = (process.env.SITECORE_FORMS_HEADER_NAME || 'x-api-key').toLowerCase();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

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
      console.warn(`[savedata] Unauthorized attempt. Received key: "${providedApiKey || 'NONE'}", expected: "${VALID_API_KEY}"`);
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

    // 2. Parse Body Payload
    const rawBody = await req.json();

    // 3. Extract Headers & Metadata sent by Sitecore AI
    const formIdHeader =
      req.headers.get('x-formid') ||
      req.headers.get('x-form-id') ||
      rawBody._formId ||
      rawBody.formId ||
      'sitecore-ai-form';

    const formNameHeader =
      req.headers.get('x-formname') ||
      req.headers.get('x-form-name') ||
      rawBody._formName ||
      rawBody.formName ||
      'Sitecore AI Form';

    const dateHeader = req.headers.get('date');
    const userAgent = req.headers.get('user-agent') || 'Sitecore Webhook Dispatcher';
    const referer = req.headers.get('referer') || rawBody.domain || req.headers.get('origin') || 'app.sitecorecloud.io';
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('remote-addr') || '127.0.0.1';

    // 4. Save submission into storage
    const newSubmission: FormSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      formId: formIdHeader,
      formName: formNameHeader,
      submittedAt: dateHeader && !isNaN(Date.parse(dateHeader)) ? new Date(dateHeader).toISOString() : new Date().toISOString(),
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

    saveSubmission(newSubmission);

    return NextResponse.json(
      {
        isSuccessful: true,
        message: 'Submission successfully received and stored.',
        submissionId: newSubmission.id,
        receivedData: {
          formName: formNameHeader,
          formId: formIdHeader,
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
        error: error.message || 'Internal Server Error while saving submission',
      },
      {
        status: 400,
        headers: CORS_HEADERS,
      }
    );
  }
}
