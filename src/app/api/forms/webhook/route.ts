import { NextRequest } from 'next/server';
import { POST as handleSaveData, OPTIONS as handleOptions } from '../savedata/route';
import { GET as handleGetData, DELETE as handleDeleteData } from '../getdata/route';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Backward-compatible webhook handler:
 * - POST forwards to /api/forms/savedata
 * - GET forwards to /api/forms/getdata
 * - DELETE forwards to /api/forms/getdata
 */
export async function POST(req: NextRequest) {
  return handleSaveData(req);
}

export async function GET(req: NextRequest) {
  return handleGetData(req);
}

export async function DELETE(req: NextRequest) {
  return handleDeleteData(req);
}
