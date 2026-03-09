import { NextResponse } from "next/server";
import { runNanoBananaThenRemoveBackground } from "@/lib/kie";

export const maxDuration = 180;

interface RescueErrorPayload {
  error: string;
  code: string;
  details?: string;
}

const toDetails = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 320);

const mapRescueFailure = (error: unknown): { status: number; body: RescueErrorPayload } => {
  const raw =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "Unknown rescue failure";
  const details = toDetails(raw);
  const lower = raw.toLowerCase();

  if (lower.includes("timed out")) {
    return {
      status: 504,
      body: {
        error: "Rescue mode timed out while processing the image.",
        code: "RESCUE_TIMEOUT",
        details
      }
    };
  }

  if (lower.includes("without result urls") || lower.includes("empty url")) {
    return {
      status: 502,
      body: {
        error: "Rescue mode did not receive a valid output image URL.",
        code: "RESCUE_RESULT_URL_MISSING",
        details
      }
    };
  }

  if (raw.includes("[remove-bg]")) {
    return {
      status: 502,
      body: {
        error: "Rescue mode failed during background-removal stage.",
        code: "RESCUE_REMOVE_BG_FAILED",
        details
      }
    };
  }

  if (raw.includes("[generation]")) {
    return {
      status: 502,
      body: {
        error: "Rescue mode failed during AI generation stage.",
        code: "RESCUE_GENERATION_FAILED",
        details
      }
    };
  }

  return {
    status: 500,
    body: {
      error: "Rescue mode failed while processing the uploaded image.",
      code: "RESCUE_PIPELINE_FAILED",
      details
    }
  };
};

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

    const imageUrl = await runNanoBananaThenRemoveBackground({
      prompt:
        "Create a clean, centered, front-facing product-style cutout of only the watch head from the reference image. Preserve the dial color, hands, markers, bezel, crown, and case shape. Remove the wrist, arm, original strap, and background. Keep the watch realistic, isolated, and suitable for a watch strap preview tool.",
      files: [image]
    });

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const mapped = mapRescueFailure(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
