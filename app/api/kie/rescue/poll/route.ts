import { NextResponse } from "next/server";
import { getKieTaskSnapshot } from "@/lib/kie";

export const maxDuration = 60;

interface RescueErrorPayload {
  error: string;
  code: string;
  details?: string;
}

type PollBody = {
  generationTaskId?: string;
};

const toStr = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PollBody;
    const generationTaskId = toStr(body.generationTaskId);

    if (!generationTaskId) {
      return NextResponse.json(
        {
          error: "Missing generationTaskId",
          code: "RESCUE_MISSING_GENERATION_TASK_ID"
        } satisfies RescueErrorPayload,
        { status: 400 }
      );
    }

    const generationSnapshot = await getKieTaskSnapshot(generationTaskId);
    if (generationSnapshot.state === "running") {
      return NextResponse.json({
        status: "running",
        stage: "regenerating",
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

    return NextResponse.json({
      status: "completed",
      stage: "completed",
      generationTaskId,
      imageUrl: generationSnapshot.resultUrl
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
