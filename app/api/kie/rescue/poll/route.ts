import { NextResponse } from "next/server";
import { createRemoveBackgroundTaskFromUrl, getKieTaskSnapshot } from "@/lib/kie";

export const maxDuration = 60;

interface RescueErrorPayload {
  error: string;
  code: string;
  details?: string;
}

type PollBody = {
  generationTaskId?: string;
  removeTaskId?: string;
};

const toStr = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PollBody;
    const generationTaskId = toStr(body.generationTaskId);
    const removeTaskId = toStr(body.removeTaskId);

    if (!generationTaskId) {
      return NextResponse.json(
        {
          error: "Missing generationTaskId",
          code: "RESCUE_MISSING_GENERATION_TASK_ID"
        } satisfies RescueErrorPayload,
        { status: 400 }
      );
    }

    if (removeTaskId) {
      const removeSnapshot = await getKieTaskSnapshot(removeTaskId);
      if (removeSnapshot.state === "running") {
        return NextResponse.json({
          status: "running",
          stage: "remove-bg",
          generationTaskId,
          removeTaskId
        });
      }
      if (removeSnapshot.state === "failed") {
        return NextResponse.json(
          {
            error: "Rescue mode failed during background removal stage.",
            code: "RESCUE_REMOVE_BG_FAILED",
            details: removeSnapshot.details
          } satisfies RescueErrorPayload,
          { status: 502 }
        );
      }
      if (!removeSnapshot.resultUrl) {
        return NextResponse.json(
          {
            error: "Rescue mode completed without a valid output image URL.",
            code: "RESCUE_RESULT_URL_MISSING"
          } satisfies RescueErrorPayload,
          { status: 502 }
        );
      }
      return NextResponse.json({
        status: "completed",
        stage: "completed",
        generationTaskId,
        removeTaskId,
        imageUrl: removeSnapshot.resultUrl
      });
    }

    const generationSnapshot = await getKieTaskSnapshot(generationTaskId);
    if (generationSnapshot.state === "running") {
      return NextResponse.json({
        status: "running",
        stage: "generation",
        generationTaskId
      });
    }
    if (generationSnapshot.state === "failed") {
      return NextResponse.json(
        {
          error: "Rescue mode failed during generation stage.",
          code: "RESCUE_GENERATION_FAILED",
          details: generationSnapshot.details
        } satisfies RescueErrorPayload,
        { status: 502 }
      );
    }
    if (!generationSnapshot.resultUrl) {
      return NextResponse.json(
        {
          error: "Generation finished without an output URL.",
          code: "RESCUE_RESULT_URL_MISSING"
        } satisfies RescueErrorPayload,
        { status: 502 }
      );
    }

    const createdRemoveTaskId = await createRemoveBackgroundTaskFromUrl(generationSnapshot.resultUrl);
    return NextResponse.json({
      status: "running",
      stage: "remove-bg",
      generationTaskId,
      removeTaskId: createdRemoveTaskId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rescue poll failed";
    return NextResponse.json(
      {
        error: "Rescue mode polling failed.",
        code: "RESCUE_POLL_FAILED",
        details: message
      } satisfies RescueErrorPayload,
      { status: 500 }
    );
  }
}
