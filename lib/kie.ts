const UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload";
const CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const TASK_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const toSnippet = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 240);
const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`[network-timeout] ${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const getApiKey = () => {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new Error("KIE_API_KEY is not configured");
  }
  return apiKey;
};

const normalizeExternalUrl = (raw: string) => {
  let value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!value) {
    throw new Error("Empty URL returned by Kie");
  }
  if (value.startsWith("//")) {
    value = `https:${value}`;
  } else if (value.startsWith("/")) {
    value = `https://tempfile.aiquickdraw.com${value}`;
  } else if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  // Validate the final URL shape before use.
  // eslint-disable-next-line no-new
  new URL(value);
  return value;
};

const extractResultUrls = (data: { resultJson?: string | { resultUrls?: string[] } }) => {
  if (typeof data.resultJson === "object" && data.resultJson) {
    const objectPayload = data.resultJson as {
      resultUrls?: string[];
      resultUrl?: string;
      imageUrl?: string;
      url?: string;
    };
    if (Array.isArray(objectPayload.resultUrls) && objectPayload.resultUrls.length) {
      return objectPayload.resultUrls;
    }
    const singleCandidate =
      objectPayload.resultUrl || objectPayload.imageUrl || objectPayload.url;
    return singleCandidate ? [singleCandidate] : [];
  }

  if (typeof data.resultJson === "string") {
    try {
      const parsed = JSON.parse(data.resultJson) as {
        resultUrls?: string[];
        resultUrl?: string;
        imageUrl?: string;
        url?: string;
      };
      if (Array.isArray(parsed.resultUrls) && parsed.resultUrls.length) {
        return parsed.resultUrls;
      }
      const singleCandidate = parsed.resultUrl || parsed.imageUrl || parsed.url;
      return singleCandidate ? [singleCandidate] : [];
    } catch {
      if (/^\/\//.test(data.resultJson) || /^https?:\/\//i.test(data.resultJson) || /^\//.test(data.resultJson)) {
        return [data.resultJson];
      }
      return [];
    }
  }

  return [];
};

export interface KieTaskSnapshot {
  state: "running" | "succeeded" | "failed";
  rawState: string;
  resultUrl?: string;
  details?: string;
}

export const uploadFileToKie = async (
  file: File,
  uploadPath = "images/watch-strap-visualizer"
) => {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("uploadPath", uploadPath);

  const response = await fetchWithTimeout(
    UPLOAD_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`
      },
      body: form
    },
    45000,
    "Kie upload"
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[upload] Kie upload failed: ${response.status}${
        errorText ? ` ${toSnippet(errorText)}` : ""
      }`
    );
  }

  const payload = await response.json();
  const data = payload?.data ?? {};
  const fileUrl = data.downloadUrl ?? data.url ?? data.fileUrl;
  if (!fileUrl) {
    throw new Error("[upload] Kie upload did not return a file URL");
  }
  return fileUrl as string;
};

export const createKieTask = async (model: string, input: Record<string, unknown>) => {
  const response = await fetchWithTimeout(
    CREATE_TASK_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({ model, input })
    },
    30000,
    `Kie createTask (${model})`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[createTask] Kie createTask failed (${model}): ${response.status} ${toSnippet(errorText)}`
    );
  }

  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (!taskId) {
    throw new Error(`[createTask] Kie createTask did not return a taskId (${model})`);
  }

  return taskId as string;
};

export const getKieTaskSnapshot = async (taskId: string): Promise<KieTaskSnapshot> => {
  const response = await fetchWithTimeout(
    `${TASK_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${getApiKey()}`
      },
      cache: "no-store"
    },
    20000,
    "Kie status poll"
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[poll] Kie status poll failed: ${response.status}${
        errorText ? ` ${toSnippet(errorText)}` : ""
      }`
    );
  }

  const payload = await response.json();
  const data = payload?.data ?? {};
  const rawState = String(data.state || "unknown").toLowerCase();

  if (rawState === "failed" || rawState === "error") {
    return {
      state: "failed",
      rawState,
      details: toSnippet(JSON.stringify(data))
    };
  }

  if (rawState === "success" || rawState === "completed") {
    const resultUrl = extractResultUrls(data)
      .map((candidate) => {
        try {
          return normalizeExternalUrl(candidate);
        } catch {
          return null;
        }
      })
      .find((candidate): candidate is string => Boolean(candidate));

    return {
      state: "succeeded",
      rawState,
      resultUrl
    };
  }

  return {
    state: "running",
    rawState
  };
};

export const waitForKieResult = async (taskId: string, maxAttempts = 90, delayMs = 3000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(delayMs);

    const response = await fetchWithTimeout(
      `${TASK_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: {
          Authorization: `Bearer ${getApiKey()}`
        },
        cache: "no-store"
      },
      20000,
      "Kie status poll"
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[poll] Kie status poll failed: ${response.status}${
          errorText ? ` ${toSnippet(errorText)}` : ""
        }`
      );
    }

    const payload = await response.json();
    const data = payload?.data ?? {};
    const state = data.state as string | undefined;

    if (state === "success" || state === "completed") {
      const resultUrls = extractResultUrls(data)
        .map((candidate) => {
          try {
            return normalizeExternalUrl(candidate);
          } catch {
            return null;
          }
        })
        .filter((candidate): candidate is string => Boolean(candidate));
      if (!resultUrls.length) {
        throw new Error("[poll] Kie task completed without result URLs");
      }
      return resultUrls[0];
    }

    if (state === "failed" || state === "error") {
      throw new Error(`[poll] Kie task failed: ${toSnippet(JSON.stringify(data))}`);
    }
  }

  throw new Error("[poll] Kie task timed out");
};

export const runRemoveBackground = async (file: File) => {
  const imageUrl = await uploadFileToKie(file);
  const taskId = await createKieTask("recraft/remove-background", { image: imageUrl });
  return waitForKieResult(taskId);
};

export const runNanoBananaImageTask = async ({
  prompt,
  files,
  aspectRatio = "1:1",
  resolution = "1K",
  outputFormat = "png"
}: {
  prompt: string;
  files: File[];
  aspectRatio?: string;
  resolution?: string;
  outputFormat?: string;
}) => {
  const imageInput = await Promise.all(files.map((file) => uploadFileToKie(file)));
  const taskId = await createKieTask("nano-banana-2", {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    output_format: outputFormat,
    image_input: imageInput
  });
  return waitForKieResult(taskId);
};

export const createNanoBananaTaskFromFiles = async ({
  prompt,
  files,
  aspectRatio = "1:1",
  resolution = "1K",
  outputFormat = "png"
}: {
  prompt: string;
  files: File[];
  aspectRatio?: string;
  resolution?: string;
  outputFormat?: string;
}) => {
  const imageInput = await Promise.all(files.map((file) => uploadFileToKie(file)));
  return createKieTask("nano-banana-2", {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    output_format: outputFormat,
    image_input: imageInput
  });
};

export const createRemoveBackgroundTaskFromUrl = async (imageUrl: string) =>
  createKieTask("recraft/remove-background", { image: imageUrl });

export const runNanoBananaThenRemoveBackground = async ({
  prompt,
  files
}: {
  prompt: string;
  files: File[];
}) => {
  try {
    const imageInput = await Promise.all(files.map((file) => uploadFileToKie(file)));
    const generateTaskId = await createKieTask("nano-banana-2", {
      prompt,
      aspect_ratio: "1:1",
      resolution: "1K",
      output_format: "png",
      image_input: imageInput
    });
    const generatedUrl = await waitForKieResult(generateTaskId);
    if (!generatedUrl) {
      throw new Error("Kie generation returned an empty URL");
    }

    try {
      const removeTaskId = await createKieTask("recraft/remove-background", {
        image: generatedUrl
      });
      return await waitForKieResult(removeTaskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown remove-bg failure";
      throw new Error(`[remove-bg] ${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation failure";
    if (message.startsWith("[remove-bg]")) {
      throw error;
    }
    throw new Error(`[generation] ${message}`);
  }
};
