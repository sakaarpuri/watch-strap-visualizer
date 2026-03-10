import { NextResponse } from "next/server";
import { createNanoBananaTaskFromFiles } from "@/lib/kie";

export const maxDuration = 60;

interface ErrorPayload {
  error: string;
  code: string;
  details?: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const preview = formData.get("preview");
    const watch = formData.get("watch");
    const strapA = formData.get("strapA");
    const strapB = formData.get("strapB");
    const strapLabel = String(formData.get("strapLabel") || "selected strap");

    const files = [preview, watch, strapA, strapB].filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return NextResponse.json(
        { error: "Missing preview references", code: "FINAL_MISSING_FILES" } satisfies ErrorPayload,
        { status: 400 }
      );
    }

    const taskId = await createNanoBananaTaskFromFiles({
      prompt: `Create a premium retailer-style product mockup based on these reference images. Keep the watch identity faithful and keep the strap consistent with ${strapLabel}. Show the watch attached to the strap in a buckled or looped display pose, centered on a clean luxury product background with polished retail lighting. Preserve the chosen watch and strap combination, refine the strap attachment, shadows, and edges, and do not add extra text, props, logos, or new watch features.`,
      files
    });

    return NextResponse.json({
      status: "running",
      stage: "generating",
      taskId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Final render start failed";
    return NextResponse.json(
      {
        error: "Product mockup could not start.",
        code: "FINAL_START_FAILED",
        details: message
      } satisfies ErrorPayload,
      { status: 500 }
    );
  }
}
