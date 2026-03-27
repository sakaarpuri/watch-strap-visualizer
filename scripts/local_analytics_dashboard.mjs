import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();
const outputDir = path.join(cwd, "output", "analytics");
const outputFile = path.join(outputDir, "local-dashboard.html");
const envPath = path.join(cwd, ".env.local");

const parseEnv = (content) =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .reduce((acc, line) => {
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const rawValue = line.slice(index + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      acc[key] = value;
      return acc;
    }, {});

const formatNumber = (value) => new Intl.NumberFormat("en-GB").format(value);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const increment = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
};

const topEntries = (map, limit = 12) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

const renderTable = (title, rows, leftLabel, rightLabel) => {
  const body =
    rows.length > 0
      ? rows
          .map(
            ([label, count], index) => `
              <tr>
                <td class="rank">${index + 1}</td>
                <td>${escapeHtml(label)}</td>
                <td class="count">${formatNumber(count)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="3" class="empty">No data yet.</td></tr>`;

  return `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${escapeHtml(leftLabel)}</th>
            <th>${escapeHtml(rightLabel)}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
};

const main = async () => {
  let env = {};
  try {
    env = parseEnv(await readFile(envPath, "utf8"));
  } catch {
    // Fall back to process env only.
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add both to .env.local before running the local analytics dashboard."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const events = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("analytics_events")
      .select(
        "created_at,event_name,visitor_id,session_id,user_id,strap_id,strap_label,strap_category,tool_name,watch_source,metadata"
      )
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;
    events.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const visitorIds = new Set();
  const sessionIds = new Set();
  const userIds = new Set();
  const topStraps = new Map();
  const topTools = new Map();

  let watchUploads = 0;
  let saveImageCount = 0;
  let saveLookCount = 0;

  for (const event of events) {
    if (event.visitor_id) visitorIds.add(event.visitor_id);
    if (event.session_id) sessionIds.add(event.session_id);
    if (event.user_id) userIds.add(event.user_id);

    if (event.event_name === "watch_uploaded") {
      watchUploads += 1;
    }

    if (event.event_name === "save_image") {
      saveImageCount += 1;
    }

    if (event.event_name === "save_look") {
      saveLookCount += 1;
    }

    if (event.event_name === "strap_selected") {
      increment(topStraps, event.strap_label || event.strap_id || "Unknown strap");
    }

    if (event.event_name === "tool_used") {
      increment(topTools, event.tool_name || "Unknown tool");
    }
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Watchstrapper Local Analytics</title>
    <style>
      :root {
        --bg: #fff9f2;
        --card: rgba(255,255,255,0.82);
        --line: #ead8c0;
        --ink: #2f2418;
        --muted: #6d5b49;
        --accent: #29456f;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top right, rgba(255,184,84,0.18), transparent 24%),
          radial-gradient(circle at bottom left, rgba(52,84,132,0.08), transparent 30%),
          var(--bg);
        color: var(--ink);
      }
      .wrap {
        max-width: 1120px;
        margin: 0 auto;
      }
      h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1;
      }
      .sub {
        margin-top: 12px;
        color: var(--muted);
        font-size: 16px;
      }
      .meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .grid {
        display: grid;
        gap: 18px;
        margin-top: 28px;
      }
      .stats {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .panels {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 22px;
        box-shadow: 0 14px 32px rgba(64, 45, 24, 0.08);
        backdrop-filter: blur(10px);
      }
      .stat-label {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }
      .stat-value {
        margin-top: 10px;
        font-size: 40px;
        font-weight: 700;
        line-height: 1;
      }
      h2 {
        margin: 0 0 16px;
        font-size: 20px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 12px 0;
        border-top: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      thead th {
        border-top: 0;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .rank {
        width: 40px;
        color: var(--muted);
      }
      .count {
        width: 80px;
        text-align: right;
        font-weight: 700;
      }
      .empty {
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Watchstrapper Local Analytics</h1>
      <p class="sub">Private machine-only summary from Supabase analytics events.</p>
      <p class="meta">Events loaded: ${formatNumber(events.length)}</p>

      <div class="grid stats">
        <section class="card">
          <div class="stat-label">Visitors</div>
          <div class="stat-value">${formatNumber(visitorIds.size)}</div>
        </section>
        <section class="card">
          <div class="stat-label">Sessions</div>
          <div class="stat-value">${formatNumber(sessionIds.size)}</div>
        </section>
        <section class="card">
          <div class="stat-label">Signed-in users</div>
          <div class="stat-value">${formatNumber(userIds.size)}</div>
        </section>
        <section class="card">
          <div class="stat-label">Watch uploads</div>
          <div class="stat-value">${formatNumber(watchUploads)}</div>
        </section>
        <section class="card">
          <div class="stat-label">Save image</div>
          <div class="stat-value">${formatNumber(saveImageCount)}</div>
        </section>
        <section class="card">
          <div class="stat-label">Save look</div>
          <div class="stat-value">${formatNumber(saveLookCount)}</div>
        </section>
      </div>

      <div class="grid panels">
        ${renderTable("Top Straps", topEntries(topStraps), "Strap", "Uses")}
        ${renderTable("Top Tools", topEntries(topTools), "Tool", "Uses")}
      </div>
    </div>
  </body>
</html>`;

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, html, "utf8");

  console.log(`Local analytics dashboard written to ${outputFile}`);

  if (process.platform === "darwin") {
    execFileSync("open", [outputFile]);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
