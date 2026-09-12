/**
 * Resizes a chosen photo in the browser before it is uploaded: one wide WebP,
 * one JPEG of the same size for anything that cannot show WebP, and a small
 * JPEG for the weekly email, kept under 150 KB.
 */
export type ResizedImage = {
  webp: string;
  jpeg: string;
  emailJpeg: string;
  width: number;
  height: number;
};

const HERO_MAX_WIDTH = 1600;
const EMAIL_WIDTH = 560;
const EMAIL_MAX_BYTES = 150_000;

function draw(image: HTMLImageElement, width: number): HTMLCanvasElement {
  const scale = Math.min(1, width / image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot process this image in your browser");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const bytesOf = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

export async function resizeForGetaway(file: File): Promise<ResizedImage> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("That file is not an image we can read"));
    element.src = URL.createObjectURL(file);
  });

  const hero = draw(image, HERO_MAX_WIDTH);
  const email = draw(image, EMAIL_WIDTH);

  let emailJpeg = email.toDataURL("image/jpeg", 0.7);
  for (const quality of [0.6, 0.5, 0.4]) {
    if (bytesOf(emailJpeg) <= EMAIL_MAX_BYTES) break;
    emailJpeg = email.toDataURL("image/jpeg", quality);
  }

  URL.revokeObjectURL(image.src);
  return {
    webp: hero.toDataURL("image/webp", 0.82),
    jpeg: hero.toDataURL("image/jpeg", 0.82),
    emailJpeg,
    width: hero.width,
    height: hero.height,
  };
}
