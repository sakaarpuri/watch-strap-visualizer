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

export type JoinShape = "flat" | "curved";

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
  {
    const cached = imagePromiseCache.get(src);
    if (cached) return cached;
    const nextPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
    imagePromiseCache.set(src, nextPromise);
    nextPromise.catch(() => {
      imagePromiseCache.delete(src);
    });
    return nextPromise;
  };

const strapRenderCache = new Map<string, HTMLCanvasElement>();
const strapRenderPromiseCache = new Map<string, Promise<HTMLCanvasElement>>();
const imagePromiseCache = new Map<string, Promise<HTMLImageElement>>();

const isCheckerboardStrap = (src: string) =>
  (src.includes("/strap-selection/") && /\.(jpe?g)$/i.test(src)) ||
  src.includes("/strap-selection-kie/olive-nato-buckle.png");

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const isNearColor = (
  r: number,
  g: number,
  b: number,
  ref: { r: number; g: number; b: number },
  maxDistance: number
) => colorDistance(r, g, b, ref.r, ref.g, ref.b) <= maxDistance;

const buildCheckerTransparentCanvas = (image: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue: number[] = [];

  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)]
  ];

  const samples = samplePoints.map(([x, y]) => {
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  });
  const sortedByLuma = samples.sort((a, b) => luma(a.r, a.g, a.b) - luma(b.r, b.g, b.b));
  const bgDark = sortedByLuma[0];
  const bgLight = sortedByLuma[sortedByLuma.length - 1];

  const isBgPixel = (idx: number) => {
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lowSaturation = max - min < 42;
    if (!lowSaturation) return false;
    return (
      isNearColor(r, g, b, bgDark, 68) ||
      isNearColor(r, g, b, bgLight, 68)
    );
  };

  const enqueue = (idx: number) => {
    if (idx < 0 || idx >= total || visited[idx]) return;
    if (!isBgPixel(idx)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x > 0) enqueue(idx - 1);
    if (x < width - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - width);
    if (y < height - 1) enqueue(idx + width);
  }

  for (const idx of queue) {
    data[idx * 4 + 3] = 0;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return canvas;
  }

  ctx.putImageData(imageData, 0, 0);

  const pad = 2;
  const cropX = clamp(minX - pad, 0, width - 1);
  const cropY = clamp(minY - pad, 0, height - 1);
  const cropW = clamp(maxX - minX + 1 + pad * 2, 1, width - cropX);
  const cropH = clamp(maxY - minY + 1 + pad * 2, 1, height - cropY);

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return canvas;
  outCtx.clearRect(0, 0, cropW, cropH);
  outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
};

export const loadStrapImage = async (
  src: string
): Promise<HTMLImageElement | HTMLCanvasElement> => {
  if (!isCheckerboardStrap(src)) {
    return loadImage(src);
  }
  const cached = strapRenderCache.get(src);
  if (cached) return cached;
  const inFlight = strapRenderPromiseCache.get(src);
  if (inFlight) return inFlight;
  const nextPromise = (async () => {
    const image = await loadImage(src);
    const cleaned = buildCheckerTransparentCanvas(image);
    strapRenderCache.set(src, cleaned);
    strapRenderPromiseCache.delete(src);
    return cleaned;
  })();
  strapRenderPromiseCache.set(src, nextPromise);
  return nextPromise;
};

interface StrapMetrics {
  topY: number;
  bottomY: number;
  topWidth: number;
  bottomWidth: number;
}

interface ObjectMaskBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface WatchFitGeometry {
  bounds: ObjectMaskBounds;
  centerX: number;
  topAnchorY: number;
  bottomAnchorY: number;
  topAnchorWidth: number;
  bottomAnchorWidth: number;
  confidence: number;
}

export interface AutoPlacementResult {
  partA: PartTransform;
  partB: PartTransform;
  confidence: number;
}

export interface PreviewLugGuides {
  centerX: number;
  topY: number;
  bottomY: number;
  topWidth: number;
  bottomWidth: number;
  confidence: number;
}

export interface PreviewLugGuideOverrides {
  centerX?: number;
  topY?: number;
  bottomY?: number;
  topWidth?: number;
  bottomWidth?: number;
}

const getImageMetrics = (image: HTMLImageElement | HTMLCanvasElement): StrapMetrics => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      topY: 0,
      bottomY: Math.max(0, image.height - 1),
      topWidth: image.width,
      bottomWidth: image.width
    };
  }

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const rowWidth = (y: number) => {
    let minX = width;
    let maxX = -1;
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > 12) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    return maxX >= minX ? maxX - minX + 1 : 0;
  };

  let topY = 0;
  while (topY < height && rowWidth(topY) === 0) topY += 1;

  let bottomY = height - 1;
  while (bottomY >= 0 && rowWidth(bottomY) === 0) bottomY -= 1;

  if (topY >= height || bottomY < 0 || bottomY <= topY) {
    return {
      topY: 0,
      bottomY: Math.max(0, image.height - 1),
      topWidth: image.width,
      bottomWidth: image.width
    };
  }

  const opaqueHeight = bottomY - topY + 1;
  const sampleFractions = [0.05, 0.08, 0.12, 0.16, 0.2];
  const sampledTopWidths: number[] = [];
  const sampledBottomWidths: number[] = [];

  for (const fraction of sampleFractions) {
    const depth = Math.round(opaqueHeight * fraction);
    const topSampleY = Math.min(bottomY, topY + depth);
    const bottomSampleY = Math.max(topY, bottomY - depth);
    const topSampleWidth = rowWidth(topSampleY);
    const bottomSampleWidth = rowWidth(bottomSampleY);
    if (topSampleWidth > 0) sampledTopWidths.push(topSampleWidth);
    if (bottomSampleWidth > 0) sampledBottomWidths.push(bottomSampleWidth);
  }

  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : image.width;

  return {
    topY,
    bottomY,
    topWidth: average(sampledTopWidths),
    bottomWidth: average(sampledBottomWidths)
  };
};

const watchFitCache = new Map<string, WatchFitGeometry>();

const buildObjectMaskBounds = (
  image: HTMLImageElement,
  bg: { r: number; g: number; b: number }
): ObjectMaskBounds | null => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const width = canvas.width;
  const height = canvas.height;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 18) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (dist < 36 && saturation < 24) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { left: minX, top: minY, right: maxX, bottom: maxY };
};

const detectWatchFitGeometry = (src: string, image: HTMLImageElement): WatchFitGeometry => {
  const cached = watchFitCache.get(src);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback: WatchFitGeometry = {
      bounds: { left: 0, top: 0, right: image.width - 1, bottom: image.height - 1 },
      centerX: image.width / 2,
      topAnchorY: image.height * 0.22,
      bottomAnchorY: image.height * 0.78,
      topAnchorWidth: image.width * 0.32,
      bottomAnchorWidth: image.width * 0.32,
      confidence: 0.35
    };
    watchFitCache.set(src, fallback);
    return fallback;
  }

  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bg = averageCornerColor(data, width, height);
  const bounds = buildObjectMaskBounds(image, bg) || {
    left: 0,
    top: 0,
    right: width - 1,
    bottom: height - 1
  };

  const objectWidth = bounds.right - bounds.left + 1;
  const objectHeight = bounds.bottom - bounds.top + 1;
  const rowStats: Array<{ y: number; width: number; centerX: number }> = [];

  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    let minX = width;
    let maxX = -1;
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 18) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b);
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (dist < 36 && saturation < 24) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (maxX >= minX) {
      rowStats.push({ y, width: maxX - minX + 1, centerX: (minX + maxX) / 2 });
    }
  }

  if (!rowStats.length) {
    const fallback: WatchFitGeometry = {
      bounds,
      centerX: (bounds.left + bounds.right) / 2,
      topAnchorY: bounds.top + objectHeight * 0.2,
      bottomAnchorY: bounds.bottom - objectHeight * 0.2,
      topAnchorWidth: objectWidth * 0.3,
      bottomAnchorWidth: objectWidth * 0.3,
      confidence: 0.35
    };
    watchFitCache.set(src, fallback);
    return fallback;
  }

  const objectCenterX =
    rowStats.reduce((sum, row) => sum + row.centerX, 0) / rowStats.length;
  const maxRowWidth = Math.max(...rowStats.map((row) => row.width));
  const topBandStart = bounds.top + objectHeight * 0.01;
  const topBandEnd = bounds.top + objectHeight * 0.2;
  const bottomBandStart = bounds.top + objectHeight * 0.8;
  const bottomBandEnd = bounds.top + objectHeight * 0.99;

  const scoreRow = (row: { y: number; width: number; centerX: number }, targetBandCenter: number) => {
    const normalizedWidth = clamp(row.width / Math.max(1, maxRowWidth), 0, 1);
    const widthPreference = 1 - Math.abs(normalizedWidth - 0.26);
    const centerPenalty = Math.abs(row.centerX - objectCenterX) / Math.max(1, objectWidth * 0.18);
    const bandPenalty = Math.abs(row.y - targetBandCenter) / Math.max(1, objectHeight * 0.09);
    return widthPreference - centerPenalty * 0.42 - bandPenalty * 0.28;
  };

  const topBandRows = rowStats.filter((row) => row.y >= topBandStart && row.y <= topBandEnd);
  const bottomBandRows = rowStats.filter((row) => row.y >= bottomBandStart && row.y <= bottomBandEnd);
  const topBandCenter = (topBandStart + topBandEnd) / 2;
  const bottomBandCenter = (bottomBandStart + bottomBandEnd) / 2;

  const pickBestRow = (
    rows: Array<{ y: number; width: number; centerX: number }>,
    bandCenter: number,
    fallbackY: number
  ) => {
    if (!rows.length) {
      return {
        y: fallbackY,
        width: objectWidth * 0.32
      };
    }
    return rows.reduce((best, row) => {
      const score = scoreRow(row, bandCenter);
      if (!best || score > best.score) {
        return { y: row.y, width: row.width, score };
      }
      return best;
    }, null as null | { y: number; width: number; score: number }) || {
      y: fallbackY,
      width: objectWidth * 0.32,
      score: 0
    };
  };

  const topBest = pickBestRow(topBandRows, topBandCenter, bounds.top + objectHeight * 0.22);
  const bottomBest = pickBestRow(bottomBandRows, bottomBandCenter, bounds.bottom - objectHeight * 0.22);
  const anchorOffset = clamp(objectHeight * 0.018, 10, 22);
  const topAnchorY = clamp(topBest.y - anchorOffset, bounds.top - anchorOffset, bounds.top + objectHeight * 0.18);
  const bottomAnchorY = clamp(
    bottomBest.y + anchorOffset,
    bounds.bottom - objectHeight * 0.18,
    bounds.bottom + anchorOffset
  );

  const centerSpread =
    rowStats.reduce((sum, row) => sum + Math.abs(row.centerX - objectCenterX), 0) /
    Math.max(1, rowStats.length);
  const symmetryScore = 1 - clamp(centerSpread / Math.max(1, objectWidth * 0.08), 0, 1);
  const coverageScore = clamp((objectWidth * objectHeight) / Math.max(1, width * height * 0.22), 0, 1);
  const anchorScore =
    1 -
    clamp(
      Math.abs(topBest.width - bottomBest.width) / Math.max(1, Math.max(topBest.width, bottomBest.width)),
      0,
      1
    );
  const confidence = clamp(symmetryScore * 0.35 + coverageScore * 0.25 + anchorScore * 0.4, 0.2, 0.95);

  const geometry: WatchFitGeometry = {
    bounds,
    centerX: objectCenterX,
    topAnchorY,
    bottomAnchorY,
    topAnchorWidth: clamp(topBest.width, objectWidth * 0.16, objectWidth * 0.52),
    bottomAnchorWidth: clamp(bottomBest.width, objectWidth * 0.16, objectWidth * 0.52),
    confidence
  };
  watchFitCache.set(src, geometry);
  return geometry;
};

const getWatchObjectPlacement = (
  src: string,
  image: HTMLImageElement,
  watchScale = 1
) => {
  const watchRect = getWatchRect(image, watchScale);
  const geometry = detectWatchFitGeometry(src, image);
  const scaleX = watchRect.w / image.width;
  const scaleY = watchRect.h / image.height;
  const bounds = {
    left: watchRect.x + geometry.bounds.left * scaleX,
    right: watchRect.x + geometry.bounds.right * scaleX,
    top: watchRect.y + geometry.bounds.top * scaleY,
    bottom: watchRect.y + geometry.bounds.bottom * scaleY
  };
  return {
    geometry,
    bounds,
    centerX: watchRect.x + geometry.centerX * scaleX,
    topAnchorY: watchRect.y + geometry.topAnchorY * scaleY,
    bottomAnchorY: watchRect.y + geometry.bottomAnchorY * scaleY,
    topAnchorWidth: geometry.topAnchorWidth * scaleX,
    bottomAnchorWidth: geometry.bottomAnchorWidth * scaleX
  };
};

export const detectPreviewLugGuides = async (
  watchSrc: string,
  watchScale = 1
): Promise<PreviewLugGuides> => {
  const watch = await loadImage(watchSrc);
  const placement = getWatchObjectPlacement(watchSrc, watch, watchScale);
  return {
    centerX: placement.centerX,
    topY: placement.topAnchorY,
    bottomY: placement.bottomAnchorY,
    topWidth: placement.topAnchorWidth,
    bottomWidth: placement.bottomAnchorWidth,
    confidence: placement.geometry.confidence
  };
};

const calculateBaselinePlacement = (
  watch: HTMLImageElement,
  partAImage: HTMLImageElement | HTMLCanvasElement,
  partBImage: HTMLImageElement | HTMLCanvasElement,
  targetWidthFactor = 0.32,
  gapFactor = 1,
  watchScale = 1
) => {
  const watchRect = getWatchRect(watch, watchScale);
  const targetStrapWidth = watchRect.w * targetWidthFactor;
  const visualGap = Math.max(18, watchRect.h * 0.045) * gapFactor;
  const metricsA = getImageMetrics(partAImage);
  const metricsB = getImageMetrics(partBImage);

  const scaleA = clamp((targetStrapWidth / metricsA.bottomWidth) * 100, 30, 230);
  const scaleB = clamp((targetStrapWidth / metricsB.topWidth) * 100, 30, 230);

  const topEdge = watchRect.y - CANVAS_SIZE / 2;
  const bottomEdge = watchRect.y + watchRect.h - CANVAS_SIZE / 2;
  const visibleBottomOffsetA = (partAImage.height / 2 - metricsA.bottomY) * (scaleA / 100);
  const visibleTopOffsetB = (metricsB.topY - partBImage.height / 2) * (scaleB / 100);

  const partA: PartTransform = {
    scale: scaleA,
    x: 0,
    y: topEdge + visibleBottomOffsetA - visualGap,
    rotation: 0,
    opacity: 1
  };

  const partB: PartTransform = {
    scale: scaleB,
    x: 0,
    y: bottomEdge - visibleTopOffsetB + visualGap,
    rotation: 0,
    opacity: 1
  };

  const viewportMargin = 28;
  const topViewport = -CANVAS_SIZE / 2 + viewportMargin;
  const bottomViewport = CANVAS_SIZE / 2 - viewportMargin;

  const visibleTopA = partA.y + (metricsA.topY - partAImage.height / 2) * (scaleA / 100);
  if (visibleTopA < topViewport) {
    partA.y += topViewport - visibleTopA;
  }

  const visibleBottomB =
    partB.y + (metricsB.bottomY - partBImage.height / 2) * (scaleB / 100);
  if (visibleBottomB > bottomViewport) {
    partB.y -= visibleBottomB - bottomViewport;
  }

  return { partA, partB };
};

const drawPart = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  transform: PartTransform,
  style: StrapStyle,
  joinEdge: "top" | "bottom" | null = null,
  joinShape: JoinShape = "flat"
) => {
  const scale = transform.scale / 100;
  const w = image.width * scale;
  const h = image.height * scale;

  ctx.save();
  ctx.translate(CANVAS_SIZE / 2 + transform.x, CANVAS_SIZE / 2 + transform.y);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.globalAlpha = transform.opacity;
  if (joinEdge && joinShape === "curved") {
    const left = -w / 2;
    const right = w / 2;
    const top = -h / 2;
    const bottom = h / 2;
    const depth = Math.min(w * 0.2, 18);
    ctx.beginPath();
    if (joinEdge === "bottom") {
      ctx.moveTo(left, top);
      ctx.lineTo(left, bottom);
      ctx.quadraticCurveTo(0, bottom - depth, right, bottom);
      ctx.lineTo(right, top);
    } else {
      ctx.moveTo(left, top);
      ctx.quadraticCurveTo(0, top + depth, right, top);
      ctx.lineTo(right, bottom);
      ctx.lineTo(left, bottom);
    }
    ctx.closePath();
    ctx.clip();
  }
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
  joinShape: JoinShape = "flat",
  watchScale = 1,
  sceneZoom = 1
) => {
  const [watch, partA, partB] = await Promise.all([
    loadImage(watchSrc),
    loadStrapImage(strapASrc),
    loadStrapImage(strapBSrc)
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
  drawPart(ctx, partA, transformA, style, "bottom", joinShape);
  drawPart(ctx, partB, transformB, style, "top", joinShape);
  ctx.restore();
};

export const renderStrapOverlay = async (
  canvas: HTMLCanvasElement,
  strapASrc: string,
  strapBSrc: string,
  transformA: PartTransform,
  transformB: PartTransform,
  style: StrapStyle,
  joinShape: JoinShape = "flat",
  sceneZoom = 1
) => {
  const [partA, partB] = await Promise.all([
    loadStrapImage(strapASrc),
    loadStrapImage(strapBSrc)
  ]);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.save();
  ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
  ctx.scale(sceneZoom, sceneZoom);
  ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
  drawPart(ctx, partA, transformA, style, "bottom", joinShape);
  drawPart(ctx, partB, transformB, style, "top", joinShape);
  ctx.restore();
};

export const renderWatchOnlyComposition = async (
  canvas: HTMLCanvasElement,
  watchSrc: string,
  watchScale = 1,
  sceneZoom = 1
) => {
  const watch = await loadImage(watchSrc);
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
  drawWatch(ctx, watch, watchScale);
  ctx.restore();
};

export const combineStrapParts = async (
  strapASrc: string,
  strapBSrc: string
): Promise<string> => {
  const [partA, partB] = await Promise.all([
    loadStrapImage(strapASrc),
    loadStrapImage(strapBSrc)
  ]);
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
  strapBSrc: string,
  targetWidthFactor = 0.32,
  gapFactor = 1,
  watchScale = 1,
  lugOverrides?: PreviewLugGuideOverrides
): Promise<AutoPlacementResult> => {
  const [watch, partAImage, partBImage] = await Promise.all([
    loadImage(watchSrc),
    loadStrapImage(strapASrc),
    loadStrapImage(strapBSrc)
  ]);

  const baseline = calculateBaselinePlacement(
    watch,
    partAImage,
    partBImage,
    targetWidthFactor,
    gapFactor,
    watchScale
  );

  const fittedWatch = getWatchObjectPlacement(watchSrc, watch, watchScale);
  const effectiveCenterX = lugOverrides?.centerX ?? fittedWatch.centerX;
  const effectiveTopY = lugOverrides?.topY ?? fittedWatch.topAnchorY;
  const effectiveBottomY = lugOverrides?.bottomY ?? fittedWatch.bottomAnchorY;
  const effectiveTopWidth = lugOverrides?.topWidth ?? fittedWatch.topAnchorWidth;
  const effectiveBottomWidth = lugOverrides?.bottomWidth ?? fittedWatch.bottomAnchorWidth;
  const baselineWatchRect = getWatchRect(watch, watchScale);
  const lugTopEdge = effectiveTopY - CANVAS_SIZE / 2;
  const lugBottomEdge = effectiveBottomY - CANVAS_SIZE / 2;
  const centerOffsetX = clamp(
    effectiveCenterX - CANVAS_SIZE / 2,
    -baselineWatchRect.w * 0.04,
    baselineWatchRect.w * 0.04
  );
  const blend = lugOverrides ? 1 : clamp((fittedWatch.geometry.confidence - 0.55) / 0.3, 0, 1);
  const metricsA = getImageMetrics(partAImage);
  const metricsB = getImageMetrics(partBImage);
  const baselineTargetWidth = baselineWatchRect.w * targetWidthFactor;
  const inferredJoinWidth = (effectiveTopWidth + effectiveBottomWidth) / 2;
  const safeTargetWidth = lugOverrides
    ? clamp(
        inferredJoinWidth,
        Math.min(baselineTargetWidth * 0.9, baselineWatchRect.w * 0.16),
        baselineWatchRect.w * 0.82
      )
    : blend > 0
      ? Math.min(
          baselineTargetWidth,
          clamp(inferredJoinWidth, baselineTargetWidth * 0.62, baselineTargetWidth)
        )
      : baselineTargetWidth;
  const anchorScaleA = clamp((safeTargetWidth / metricsA.bottomWidth) * 100, 30, 230);
  const anchorScaleB = clamp((safeTargetWidth / metricsB.topWidth) * 100, 30, 230);
  const scaleA = baseline.partA.scale + (anchorScaleA - baseline.partA.scale) * blend;
  const scaleB = baseline.partB.scale + (anchorScaleB - baseline.partB.scale) * blend;
  const defaultVisualGap = Math.max(18, baselineWatchRect.h * 0.045) * gapFactor;
  const visualGap = lugOverrides ? Math.max(4, defaultVisualGap * 0.18) : defaultVisualGap;
  const anchorYPartA =
    lugTopEdge + (partAImage.height / 2 - metricsA.bottomY) * (scaleA / 100) - visualGap;
  const anchorYPartB =
    lugBottomEdge - (metricsB.topY - partBImage.height / 2) * (scaleB / 100) + visualGap;
  const partA: PartTransform = {
    scale: scaleA,
    x: baseline.partA.x + centerOffsetX * blend,
    y: baseline.partA.y + (anchorYPartA - baseline.partA.y) * blend,
    rotation: 0,
    opacity: 1
  };
  const partB: PartTransform = {
    scale: scaleB,
    x: baseline.partB.x + centerOffsetX * blend,
    y: baseline.partB.y + (anchorYPartB - baseline.partB.y) * blend,
    rotation: 0,
    opacity: 1
  };

  return { partA, partB, confidence: fittedWatch.geometry.confidence };
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
