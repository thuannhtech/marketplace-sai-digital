import { NextResponse } from "next/server";
import { getReport104InventoryData } from "@/src/app/actions/ordercloud";

export async function GET() {
  const result = await getReport104InventoryData();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to load Report 104 data." },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
