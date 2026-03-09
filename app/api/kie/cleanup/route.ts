import { NextResponse } from "next/server";
import { runRemoveBackground } from "@/lib/kie";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const dataUrl = await runRemoveBackground(image);
    return NextResponse.json({ imageDataUrl: dataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dial cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
