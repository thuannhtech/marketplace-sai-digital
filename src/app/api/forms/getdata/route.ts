import { NextRequest, NextResponse } from 'next/server';
import { getAllSubmissions, deleteSubmission } from '@/src/lib/forms/storage';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/forms/getdata
 * Retrieves submissions with optional ?formId filter, returns distinct forms list for portal dropdown
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const formIdFilter = searchParams.get('formId');
    const searchFilter = searchParams.get('search')?.toLowerCase();

    const allSubmissions = await getAllSubmissions();

    // Compute distinct forms available
    const formsMap = new Map<string, { formId: string; formName: string; count: number }>();
    allSubmissions.forEach((sub) => {
      const fid = sub.formId || 'unknown-form';
      const fname = sub.formName || fid;
      const current = formsMap.get(fid);
      if (current) {
        current.count += 1;
      } else {
        formsMap.set(fid, { formId: fid, formName: fname, count: 1 });
      }
    });

    const availableForms = Array.from(formsMap.values());

    // Apply filtering if requested
    let filtered = allSubmissions;
    if (formIdFilter && formIdFilter !== 'all') {
      filtered = filtered.filter((s) => s.formId === formIdFilter);
    }
    if (searchFilter) {
      filtered = filtered.filter((s) => {
        return (
          s.formName?.toLowerCase().includes(searchFilter) ||
          s.formId?.toLowerCase().includes(searchFilter) ||
          s.pageUrl?.toLowerCase().includes(searchFilter) ||
          JSON.stringify(s.data).toLowerCase().includes(searchFilter)
        );
      });
    }

    return NextResponse.json(
      {
        success: true,
        count: filtered.length,
        totalCount: allSubmissions.length,
        availableForms,
        submissions: filtered,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error: any) {
    console.error('Error in /api/forms/getdata:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve submissions',
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}

/**
 * DELETE /api/forms/getdata?id=xxx
 * Deletes a submission by ID
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400, headers: CORS_HEADERS });
    }

    const success = await deleteSubmission(id);
    return NextResponse.json({ success }, { status: 200, headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
