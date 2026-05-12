import { NextResponse } from "next/server";
import { getOrderCloudToken } from "@/src/app/actions/ordercloud";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const productId = id?.trim();

  if (!productId) {
    return NextResponse.json({ error: "Missing OrderCloud product id." }, { status: 400 });
  }

  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      throw new Error(auth.error || "OrderCloud auth failed.");
    }

    const { Products, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);
    await Products.Delete(productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete OrderCloud product.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
