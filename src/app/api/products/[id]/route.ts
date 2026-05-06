import { NextRequest, NextResponse } from "next/server";
import {
  UpdateProductPayload,
  updateProductWithWorkato,
} from "@/src/lib/integrations/workato/workato-product-api";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Omit<UpdateProductPayload, "id">;
    const data = await updateProductWithWorkato({
      ...body,
      id,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update product.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
