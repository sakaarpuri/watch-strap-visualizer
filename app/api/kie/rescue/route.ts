import { NextResponse } from "next/server";
import { runNanoBananaThenRemoveBackground } from "@/lib/kie";

export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const imageDataUrl = await runNanoBananaThenRemoveBackground({
      prompt:
        "Create a clean, centered, front-facing product-style cutout of only the watch head from the reference image. Preserve the dial color, hands, markers, bezel, crown, and case shape. Remove the wrist, arm, original strap, and background. Keep the watch realistic, isolated, and suitable for a watch strap preview tool.",
      files: [image]
    });

    return NextResponse.json({ imageDataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rescue mode failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
