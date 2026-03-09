import { NextResponse } from "next/server";
import { createNanoBananaTaskFromFiles } from "@/lib/kie";

export const maxDuration = 60;

interface RescueErrorPayload {
  error: string;
  code: string;
  details?: string;
}

const errorPayload = (error: string, code: string, details?: string) =>
  NextResponse.json({ error, code, details } satisfies RescueErrorPayload, {
    status: 500
  });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          error: "Missing image file",
          code: "RESCUE_MISSING_IMAGE"
        } satisfies RescueErrorPayload,
        { status: 400 }
      );
    }

    const generationTaskId = await createNanoBananaTaskFromFiles({
      prompt:
        "Create a clean, centered, front-facing product-style cutout of only the watch head from the reference image. Preserve the dial color, hands, markers, bezel, crown, and case shape. Remove the wrist, arm, original strap, and background. Return only the isolated watch head on a transparent or plain clean background, with no extra props or text.",
      files: [image],
      resolution: "1K"
    });

    return NextResponse.json({
      status: "running",
      stage: "generation",
      generationTaskId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rescue start failed";
    if (message.includes("KIE_API_KEY is not configured")) {
      return NextResponse.json(
        {
          error: "Kie API key is missing on deployment",
          code: "RESCUE_MISSING_API_KEY",
          details: message
        } satisfies RescueErrorPayload,
        { status: 500 }
      );
    }
    return errorPayload("Rescue mode could not start generation.", "RESCUE_START_FAILED", message);
  }
}
