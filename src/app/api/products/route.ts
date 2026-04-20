import { NextRequest, NextResponse } from "next/server";
import {
  createProductWithWorkato,
  CreateProductPayload,
} from "@/src/lib/api/workato-product-api";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProductPayload;
    const data = await createProductWithWorkato(body);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create product.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
