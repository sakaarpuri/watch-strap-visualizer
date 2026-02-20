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
  rotation: 180,
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

const drawWatch = (ctx: CanvasRenderingContext2D, image: HTMLImageElement) => {
  const max = CANVAS_SIZE * 0.68;
  const ratio = Math.min(max / image.width, max / image.height);
  const w = image.width * ratio;
  const h = image.height * ratio;
  const x = CANVAS_SIZE / 2 - w / 2;
  const y = CANVAS_SIZE / 2 - h / 2;
  ctx.drawImage(image, x, y, w, h);
};

export const renderComposition = async (
  canvas: HTMLCanvasElement,
  watchSrc: string,
  strapASrc: string,
  strapBSrc: string,
  transformA: PartTransform,
  transformB: PartTransform,
  style: StrapStyle
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

  drawPart(ctx, partA, transformA, style);
  drawPart(ctx, partB, transformB, style);
  drawWatch(ctx, watch);
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
