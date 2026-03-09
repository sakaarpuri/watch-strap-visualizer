import { NextResponse } from "next/server";
import { runNanoBananaImageTask } from "@/lib/kie";

export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const strapA = formData.get("strapA");
    const strapB = formData.get("strapB");
    const strapLabel = String(formData.get("strapLabel") || "current strap");
    const category = String(formData.get("category") || "strap");

    const files = [strapA, strapB].filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "Missing strap references" }, { status: 400 });
    }

    const imageUrl = await runNanoBananaImageTask({
      prompt: `Create a new premium watch strap concept inspired by the attached ${strapLabel} references. Keep it in the ${category.toLowerCase()} family, preserve realistic strap proportions, and propose one adjacent color or finish that feels commercially viable. Show the strap as a clean product image on a transparent or neutral isolated background, with no watch attached, no branding, and no text.`,
      files
    });

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Style exploration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
