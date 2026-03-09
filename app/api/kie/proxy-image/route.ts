import { NextResponse } from "next/server";

const ALLOWED_HOST_PATTERNS = [
  /(^|\.)kie\.ai$/i,
  /(^|\.)redpandaai\.co$/i,
  /(^|\.)aiquickdraw\.com$/i,
  /(^|\.)amazonaws\.com$/i
];

const isAllowedHost = (host: string) =>
  ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(host));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url query param" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url query param" }, { status: 400 });
  }

  if (!/^https?:$/i.test(target.protocol)) {
    return NextResponse.json({ error: "Unsupported URL protocol" }, { status: 400 });
  }

  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: "Blocked host" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: "no-store",
      redirect: "follow"
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream image fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    const arrayBuffer = await upstream.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=120, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
