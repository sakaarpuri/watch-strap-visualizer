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
  watchScale = 1,
  sceneZoom = 1
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

  ctx.save();
  ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
  ctx.scale(sceneZoom, sceneZoom);
  ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
  // Draw watch first so new strap overlays old strap from uploaded photos.
  drawWatch(ctx, watch, watchScale);
  drawPart(ctx, partA, transformA, style);
  drawPart(ctx, partB, transformB, style);
  ctx.restore();
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

export const enhanceDialImage = async (file: File): Promise<string> => {
  const src = URL.createObjectURL(file);
  try {
    const image = await loadImage(src);
    const detectSide = 560;
    const detectScale = Math.min(1, detectSide / Math.max(image.width, image.height));
    const detectW = Math.max(120, Math.round(image.width * detectScale));
    const detectH = Math.max(120, Math.round(image.height * detectScale));

    const detect = document.createElement("canvas");
    detect.width = detectW;
    detect.height = detectH;
    const detectCtx = detect.getContext("2d");
    if (!detectCtx) return await autoCleanDialImage(file);
    detectCtx.drawImage(image, 0, 0, detectW, detectH);
    const detectData = detectCtx.getImageData(0, 0, detectW, detectH).data;

    const gray = new Float32Array(detectW * detectH);
    for (let y = 0; y < detectH; y += 1) {
      for (let x = 0; x < detectW; x += 1) {
        const i = (y * detectW + x) * 4;
        gray[y * detectW + x] = 0.299 * detectData[i] + 0.587 * detectData[i + 1] + 0.114 * detectData[i + 2];
      }
    }

    const mag = new Float32Array(detectW * detectH);
    for (let y = 1; y < detectH - 1; y += 1) {
      for (let x = 1; x < detectW - 1; x += 1) {
        const idx = y * detectW + x;
        const gx =
          -gray[idx - detectW - 1] + gray[idx - detectW + 1] -
          2 * gray[idx - 1] +
          2 * gray[idx + 1] -
          gray[idx + detectW - 1] +
          gray[idx + detectW + 1];
        const gy =
          -gray[idx - detectW - 1] -
          2 * gray[idx - detectW] -
          gray[idx - detectW + 1] +
          gray[idx + detectW - 1] +
          2 * gray[idx + detectW] +
          gray[idx + detectW + 1];
        mag[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    const integral = new Float32Array((detectW + 1) * (detectH + 1));
    for (let y = 1; y <= detectH; y += 1) {
      let row = 0;
      for (let x = 1; x <= detectW; x += 1) {
        row += gray[(y - 1) * detectW + (x - 1)];
        integral[y * (detectW + 1) + x] = integral[(y - 1) * (detectW + 1) + x] + row;
      }
    }

    const rectMean = (cx: number, cy: number, half: number) => {
      const x1 = clamp(Math.floor(cx - half), 0, detectW - 1);
      const y1 = clamp(Math.floor(cy - half), 0, detectH - 1);
      const x2 = clamp(Math.floor(cx + half), 0, detectW - 1);
      const y2 = clamp(Math.floor(cy + half), 0, detectH - 1);
      const a = integral[y1 * (detectW + 1) + x1];
      const b = integral[y1 * (detectW + 1) + (x2 + 1)];
      const c = integral[(y2 + 1) * (detectW + 1) + x1];
      const dSum = integral[(y2 + 1) * (detectW + 1) + (x2 + 1)];
      const area = Math.max(1, (x2 - x1 + 1) * (y2 - y1 + 1));
      return (dSum - b - c + a) / area;
    };

    let bestScore = -1;
    let bestX = detectW / 2;
    let bestY = detectH / 2;
    let bestR = Math.min(detectW, detectH) * 0.17;
    const minR = Math.min(detectW, detectH) * 0.08;
    const maxR = Math.min(detectW, detectH) * 0.24;

    for (let cy = Math.floor(detectH * 0.16); cy < Math.floor(detectH * 0.84); cy += 8) {
      for (let cx = Math.floor(detectW * 0.16); cx < Math.floor(detectW * 0.84); cx += 8) {
        for (let r = minR; r <= maxR; r += 3) {
          if (cx - r < 2 || cy - r < 2 || cx + r >= detectW - 2 || cy + r >= detectH - 2) continue;
          let ring = 0;
          let samples = 0;
          for (let a = 0; a < 360; a += 10) {
            const rad = (a * Math.PI) / 180;
            const x = Math.round(cx + Math.cos(rad) * r);
            const y = Math.round(cy + Math.sin(rad) * r);
            ring += mag[y * detectW + x];
            samples += 1;
          }
          ring /= Math.max(1, samples);

          const inner = rectMean(cx, cy, r * 0.55);
          const outer = rectMean(cx, cy, r * 1.18);
          const contrast = outer - inner;
          const score = ring * 0.75 + contrast * 0.9;

          if (score > bestScore) {
            bestScore = score;
            bestX = cx;
            bestY = cy;
            bestR = r;
          }
        }
      }
    }

    const sourceX = bestX / detectScale;
    const sourceY = bestY / detectScale;
    const sourceR = bestR / detectScale;

    const cropSide = clamp(
      Math.round(sourceR * 4.8),
      380,
      Math.min(image.width, image.height)
    );
    const minX = clamp(Math.round(sourceX - cropSide / 2), 0, image.width - cropSide);
    const minY = clamp(Math.round(sourceY - cropSide / 2), 0, image.height - cropSide);

    const out = document.createElement("canvas");
    out.width = cropSide;
    out.height = cropSide;
    const outCtx = out.getContext("2d");
    if (!outCtx) return await autoCleanDialImage(file);
    outCtx.drawImage(image, minX, minY, cropSide, cropSide, 0, 0, cropSide, cropSide);

    const outData = outCtx.getImageData(0, 0, cropSide, cropSide);
    const px = outData.data;
    const bg = averageCornerColor(px, cropSide, cropSide);
    const bgThreshold = 52;
    const cx = cropSide / 2;
    const cy = cropSide / 2;
    const keepR = cropSide * 0.45;

    for (let y = 0; y < cropSide; y += 1) {
      for (let x = 0; x < cropSide; x += 1) {
        const i = (y * cropSide + x) * 4;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const distBg = colorDistance(r, g, b, bg.r, bg.g, bg.b);
        const dx = x - cx;
        const dy = y - cy;
        const radial = Math.sqrt(dx * dx + dy * dy);

        if (radial > keepR * 1.2) {
          px[i + 3] = 0;
          continue;
        }
        if (distBg < bgThreshold && radial > keepR * 0.72) {
          px[i + 3] = 0;
          continue;
        }
        if (radial > keepR) {
          const fade = clamp((keepR * 1.2 - radial) / (keepR * 0.2), 0, 1);
          px[i + 3] = Math.min(px[i + 3], Math.round(px[i + 3] * fade));
        }
      }
    }

    outCtx.putImageData(outData, 0, 0);
    return out.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(src);
  }
};
