import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Server-side Google reCAPTCHA Verification Endpoint
 * Verifies client captchaToken against Google's siteverify API using RECAPTCHA_SECRET_KEY
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing reCAPTCHA token. Please complete the captcha challenge.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!secretKey) {
      console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set in .env.local, bypassing validation for development');
      return NextResponse.json(
        { success: true, bypassed: true, message: 'Dev mode bypass' },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    const googleRes = await fetch(verificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const googleData = await googleRes.json();

    if (googleData.success) {
      return NextResponse.json(
        {
          success: true,
          score: googleData.score,
          action: googleData.action,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    } else {
      console.warn('[reCAPTCHA] Verification failed:', googleData);
      return NextResponse.json(
        {
          success: false,
          error: 'reCAPTCHA verification failed with Google.',
          errorCodes: googleData['error-codes'] || [],
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }
  } catch (error: any) {
    console.error('[reCAPTCHA] Error during verification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error during reCAPTCHA verification' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
