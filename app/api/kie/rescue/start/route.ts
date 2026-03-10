import { NextResponse } from "next/server";
import { createGempixTaskFromFiles } from "@/lib/kie";

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

    const generationTaskId = await createGempixTaskFromFiles({
      prompt:
        "Create a clean, centered watch-head cutout from the reference image. Keep only the case and dial visible. Remove the wrist, original strap, and background. Preserve the watch shape and front-facing look. No extra objects or text.",
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
