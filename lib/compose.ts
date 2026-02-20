export interface PartTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
}

export interface StrapStyle {
  name: string;
  color: string;
  alpha: number;
}

export const STRAP_STYLES: StrapStyle[] = [
  { name: "Original", color: "#000000", alpha: 0 },
  { name: "Black Leather", color: "#111111", alpha: 0.3 },
  { name: "Brown Leather", color: "#6f4a2f", alpha: 0.28 },
  { name: "Olive NATO", color: "#5f6b42", alpha: 0.3 },
  { name: "Steel", color: "#8b939d", alpha: 0.22 },
  { name: "Rubber", color: "#1f1f1f", alpha: 0.36 },
  { name: "Suede", color: "#8e6c55", alpha: 0.25 }
];

export const DEFAULT_PART_A: PartTransform = {
  scale: 85,
  x: 0,
  y: -240,
  rotation: 0,
  opacity: 1
};

export const DEFAULT_PART_B: PartTransform = {
  scale: 85,
  x: 0,
  y: 240,
  rotation: 0,
  opacity: 1
};

export const CANVAS_SIZE = 900;

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

const drawPart = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  transform: PartTransform,
  style: StrapStyle
) => {
  const scale = transform.scale / 100;
  const w = image.width * scale;
  const h = image.height * scale;

  ctx.save();
  ctx.translate(CANVAS_SIZE / 2 + transform.x, CANVAS_SIZE / 2 + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.globalAlpha = transform.opacity;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);

  if (style.alpha > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = style.color;
    ctx.globalAlpha = Math.min(1, transform.opacity * style.alpha);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
};

const drawWatch = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  watchScale = 1
) => {
  const { x, y, w, h } = getWatchRect(image, watchScale);
  ctx.drawImage(image, x, y, w, h);
};

const getWatchRect = (image: HTMLImageElement, watchScale = 1) => {
  const max = CANVAS_SIZE * 0.68;
  const ratio = Math.min(max / image.width, max / image.height);
  const w = image.width * ratio * watchScale;
  const h = image.height * ratio * watchScale;
  const x = CANVAS_SIZE / 2 - w / 2;
  const y = CANVAS_SIZE / 2 - h / 2;

  return { x, y, w, h };
};

export const renderComposition = async (
  canvas: HTMLCanvasElement,
  watchSrc: string,
  strapASrc: string,
  strapBSrc: string,
  transformA: PartTransform,
  transformB: PartTransform,
  style: StrapStyle,
  watchScale = 1
) => {
  const [watch, partA, partB] = await Promise.all([
    loadImage(watchSrc),
    loadImage(strapASrc),
    loadImage(strapBSrc)
  ]);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw watch first so new strap overlays old strap from uploaded photos.
  drawWatch(ctx, watch, watchScale);
  drawPart(ctx, partA, transformA, style);
  drawPart(ctx, partB, transformB, style);
};

export const combineStrapParts = async (
  strapASrc: string,
  strapBSrc: string
): Promise<string> => {
  const [partA, partB] = await Promise.all([loadImage(strapASrc), loadImage(strapBSrc)]);
  const gap = 16;
  const targetWidth = Math.max(partA.width, partB.width);
  const aRatio = targetWidth / partA.width;
  const bRatio = targetWidth / partB.width;
  const height = Math.round(partA.height * aRatio + partB.height * bRatio + gap);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, height);

  const aHeight = partA.height * aRatio;
  ctx.drawImage(partA, 0, 0, targetWidth, aHeight);

  const bHeight = partB.height * bRatio;
  ctx.drawImage(partB, 0, aHeight + gap, targetWidth, bHeight);

  return canvas.toDataURL("image/png");
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const calculateAutoPlacement = async (
  watchSrc: string,
  strapASrc: string,
  strapBSrc: string
): Promise<{ partA: PartTransform; partB: PartTransform }> => {
  const [watch, partAImage, partBImage] = await Promise.all([
    loadImage(watchSrc),
    loadImage(strapASrc),
    loadImage(strapBSrc)
  ]);

  const watchRect = getWatchRect(watch, 1);
  const targetStrapWidth = watchRect.w * 0.42;
  const overlap = Math.max(12, watchRect.h * 0.075);

  const scaleA = clamp((targetStrapWidth / partAImage.width) * 100, 30, 230);
  const scaleB = clamp((targetStrapWidth / partBImage.width) * 100, 30, 230);

  const scaledAH = partAImage.height * (scaleA / 100);
  const scaledBH = partBImage.height * (scaleB / 100);

  const topEdge = watchRect.y - CANVAS_SIZE / 2;
  const bottomEdge = watchRect.y + watchRect.h - CANVAS_SIZE / 2;

  const partA: PartTransform = {
    scale: scaleA,
    x: 0,
    y: topEdge - scaledAH / 2 + overlap,
    rotation: 0,
    opacity: 1
  };

  const partB: PartTransform = {
    scale: scaleB,
    x: 0,
    y: bottomEdge + scaledBH / 2 - overlap,
    rotation: 0,
    opacity: 1
  };

  return { partA, partB };
};

const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

const averageCornerColor = (
  data: Uint8ClampedArray,
  width: number,
  height: number
): { r: number; g: number; b: number } => {
  const patch = Math.max(8, Math.floor(Math.min(width, height) * 0.03));
  const corners = [
    { x: 0, y: 0 },
    { x: width - patch, y: 0 },
    { x: 0, y: height - patch },
    { x: width - patch, y: height - patch }
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const corner of corners) {
    for (let y = corner.y; y < corner.y + patch; y += 1) {
      for (let x = corner.x; x < corner.x + patch; x += 1) {
        const i = (y * width + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
    }
  }

  return { r: r / count, g: g / count, b: b / count };
};

export const autoCleanDialImage = async (file: File): Promise<string> => {
  const src = URL.createObjectURL(file);
  try {
    const image = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const bg = averageCornerColor(data, canvas.width, canvas.height);
    const threshold = 42;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const closeToBg = colorDistance(r, g, b, bg.r, bg.g, bg.b) < threshold;
      const nearWhite = r > 245 && g > 245 && b > 245;
      if (closeToBg || nearWhite) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasOpaque = false;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 20) {
          hasOpaque = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasOpaque) return src;

    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.08);
    minX = clamp(minX - pad, 0, canvas.width - 1);
    minY = clamp(minY - pad, 0, canvas.height - 1);
    maxX = clamp(maxX + pad, 0, canvas.width - 1);
    maxY = clamp(maxY + pad, 0, canvas.height - 1);

    const cropWidth = Math.max(1, maxX - minX + 1);
    const cropHeight = Math.max(1, maxY - minY + 1);

    const out = document.createElement("canvas");
    out.width = cropWidth;
    out.height = cropHeight;
    const outCtx = out.getContext("2d");
    if (!outCtx) return src;

    outCtx.clearRect(0, 0, cropWidth, cropHeight);
    outCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return out.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(src);
  }
};
