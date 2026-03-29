import { NextResponse } from "next/server";
import { getSimilarProductsForStrap } from "@/lib/shopping";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const strapId = searchParams.get("strapId")?.trim();

  if (!strapId) {
    return NextResponse.json({ error: "Missing strap id" }, { status: 400 });
  }

  try {
    const products = await getSimilarProductsForStrap(strapId);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("similar-products lookup failed", { strapId, error });
    return NextResponse.json({ products: [], error: "Shopping lookup failed" }, { status: 200 });
  }
}
