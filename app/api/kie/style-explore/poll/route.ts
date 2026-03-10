import { NextResponse } from "next/server";
import { getKieTaskSnapshot } from "@/lib/kie";

export const maxDuration = 60;

interface ErrorPayload {
  error: string;
  code: string;
  details?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { taskId?: string };
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing taskId", code: "EXPLORE_MISSING_TASK_ID" } satisfies ErrorPayload,
        { status: 400 }
      );
    }

    const snapshot = await getKieTaskSnapshot(taskId);
    if (snapshot.state === "running") {
      return NextResponse.json({ status: "running", stage: "generating", taskId });
    }
    if (snapshot.state === "failed") {
      return NextResponse.json(
        {
          error: "New strap idea failed during generation.",
          code: "EXPLORE_GENERATION_FAILED",
          details: snapshot.details
        } satisfies ErrorPayload,
        { status: 502 }
      );
    }
    if (!snapshot.resultUrl) {
      return NextResponse.json(
        {
          error: "New strap idea finished without an output URL.",
          code: "EXPLORE_RESULT_URL_MISSING"
        } satisfies ErrorPayload,
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: "completed",
      stage: "completed",
      taskId,
      imageUrl: snapshot.resultUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Style explore poll failed";
    return NextResponse.json(
      {
        error: "New strap idea polling failed.",
        code: "EXPLORE_POLL_FAILED",
        details: message
      } satisfies ErrorPayload,
      { status: 500 }
    );
  }
}
