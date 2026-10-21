import { NextResponse } from "next/server";
import { getReport104InventoryData } from "@/src/app/actions/ordercloud";
import { uploadReport104ToFabric } from "@/src/lib/integrations/fabric/fabric-report-104";

export const runtime = "nodejs";

export async function POST() {
  const reportResult = await getReport104InventoryData();

  if (!reportResult.success || !reportResult.data) {
    return NextResponse.json(
      { error: reportResult.error || "Failed to load Report 104 data from OrderCloud." },
      { status: 502 },
    );
  }

  try {
    const uploadResult = await uploadReport104ToFabric(reportResult.data);
    return NextResponse.json(uploadResult, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload Report 104 CSV to Sitecore Connect." },
      { status: 502 },
    );
  }
}
