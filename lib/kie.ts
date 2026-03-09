const UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload";
const CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const TASK_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getApiKey = () => {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new Error("KIE_API_KEY is not configured");
  }
  return apiKey;
};

const extractResultUrls = (data: { resultJson?: string | { resultUrls?: string[] } }) => {
  if (typeof data.resultJson === "object" && data.resultJson) {
    return data.resultJson.resultUrls ?? [];
  }

  if (typeof data.resultJson === "string") {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      return parsed.resultUrls ?? [];
    } catch {
      return [];
    }
  }

  return [];
};

export const uploadFileToKie = async (
  file: File,
  uploadPath = "images/watch-strap-visualizer"
) => {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("uploadPath", uploadPath);

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`
    },
    body: form
  });

  if (!response.ok) {
    throw new Error(`Kie upload failed: ${response.status}`);
  }

  const payload = await response.json();
  const data = payload?.data ?? {};
  const fileUrl = data.downloadUrl ?? data.url ?? data.fileUrl;
  if (!fileUrl) {
    throw new Error("Kie upload did not return a file URL");
  }
  return fileUrl as string;
};

export const createKieTask = async (model: string, input: Record<string, unknown>) => {
  const response = await fetch(CREATE_TASK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify({ model, input })
  });

  if (!response.ok) {
    throw new Error(`Kie createTask failed: ${response.status}`);
  }

  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (!taskId) {
    throw new Error("Kie createTask did not return a taskId");
  }

  return taskId as string;
};

export const waitForKieResult = async (taskId: string, maxAttempts = 90, delayMs = 3000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(delayMs);

    const response = await fetch(`${TASK_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Kie status poll failed: ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? {};
    const state = data.state as string | undefined;

    if (state === "success" || state === "completed") {
      const resultUrls = extractResultUrls(data);
      if (!resultUrls.length) {
        throw new Error("Kie task completed without result URLs");
      }
      return resultUrls[0];
    }

    if (state === "failed" || state === "error") {
      throw new Error(`Kie task failed: ${JSON.stringify(data)}`);
    }
  }

  throw new Error("Kie task timed out");
};

export const downloadAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download result: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/png";
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
};

export const runRemoveBackground = async (file: File) => {
  const imageUrl = await uploadFileToKie(file);
  const taskId = await createKieTask("recraft/remove-background", { image: imageUrl });
  const resultUrl = await waitForKieResult(taskId);
  return downloadAsDataUrl(resultUrl);
};

export const runNanoBananaImageTask = async ({
  prompt,
  files,
  aspectRatio = "1:1",
  resolution = "2K",
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
  const resultUrl = await waitForKieResult(taskId);
  return downloadAsDataUrl(resultUrl);
};

export const runNanoBananaThenRemoveBackground = async ({
  prompt,
  files
}: {
  prompt: string;
  files: File[];
}) => {
  const imageInput = await Promise.all(files.map((file) => uploadFileToKie(file)));
  const generateTaskId = await createKieTask("nano-banana-2", {
    prompt,
    aspect_ratio: "1:1",
    resolution: "2K",
    output_format: "png",
    image_input: imageInput
  });
  const generatedUrl = await waitForKieResult(generateTaskId);
  const removeTaskId = await createKieTask("recraft/remove-background", {
    image: generatedUrl
  });
  const cleanedUrl = await waitForKieResult(removeTaskId);
  return downloadAsDataUrl(cleanedUrl);
};
