import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const VISITOR_KEY = "watchstrapper_visitor_id";
const SESSION_KEY = "__watchstrapperSessionId";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const getVisitorId = () => {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = makeId();
  window.localStorage.setItem(VISITOR_KEY, next);
  return next;
};

export const getSessionId = () => {
  if (typeof window === "undefined") return "server";
  const keyedWindow = window as typeof window & { [SESSION_KEY]?: string };
  if (!keyedWindow[SESSION_KEY]) {
    keyedWindow[SESSION_KEY] = makeId();
  }
  return keyedWindow[SESSION_KEY] as string;
};

export type AnalyticsPayload = {
  user_id?: string | null;
  strap_id?: string | null;
  strap_label?: string | null;
  strap_category?: string | null;
  tool_name?: string | null;
  watch_source?: string | null;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(eventName: string, payload: AnalyticsPayload = {}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  try {
    await supabase.from("analytics_events").insert({
      event_name: eventName,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      user_id: payload.user_id ?? null,
      strap_id: payload.strap_id ?? null,
      strap_label: payload.strap_label ?? null,
      strap_category: payload.strap_category ?? null,
      tool_name: payload.tool_name ?? null,
      watch_source: payload.watch_source ?? null,
      metadata: payload.metadata ?? {}
    });
  } catch {
    // Keep analytics entirely non-blocking.
  }
}
