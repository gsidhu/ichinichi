/**
 * Image compression and resizing utility
 * Reduces file size for images larger than the specified limit
 */

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

const DEFAULT_TARGET_SIZE = 1024 * 1024; // 1MB
const INITIAL_JPEG_QUALITY = 0.8;
const MIN_JPEG_QUALITY = 0.6;
const JPEG_QUALITY_STEP = 0.08;
const MAX_DIMENSION = 2000; // Tighter ceiling for large uploads
const MIN_DIMENSION = 500;
const DIMENSION_REDUCTION_FACTOR = 0.85;

/**
 * Compresses an image file if it exceeds the max size
 * Uses canvas API to resize and compress
 * @param file - The image file to compress
 * @param maxSizeBytes - Maximum file size in bytes (default 2MB)
 * @returns Compressed image with metadata
 */
export async function compressImage(
  file: File,
  maxSizeBytes: number = DEFAULT_TARGET_SIZE,
): Promise<CompressedImage> {
  const dimensions = await getImageDimensions(file);
  const shouldResize =
    dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION;

  // If file is already small enough and within the dimension ceiling, keep it.
  if (file.size <= maxSizeBytes && !shouldResize) {
    return {
      blob: file,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: file.type,
    };
  }

  // Load image
  const img = await loadImage(file);

  // Calculate target dimensions
  let { width, height } = calculateTargetDimensions(
    img.width,
    img.height,
    MAX_DIMENSION,
  );

  // Determine output format (JPEG for photos, PNG for transparency)
  const hasAlpha = await imageHasTransparency(file);
  const outputMimeType = hasAlpha
    ? file.type === "image/webp"
      ? "image/webp"
      : "image/png"
    : "image/jpeg";

  const result = hasAlpha
    ? await compressTransparentImage(img, width, height, outputMimeType, maxSizeBytes)
    : await compressOpaqueImage(img, width, height, maxSizeBytes);

  return {
    blob: result.blob,
    width: result.width,
    height: result.height,
    mimeType: result.mimeType,
  };
}

async function compressOpaqueImage(
  img: HTMLImageElement,
  initialWidth: number,
  initialHeight: number,
  maxSizeBytes: number,
): Promise<CompressedImage> {
  let width = initialWidth;
  let height = initialHeight;
  let bestBlob: Blob | null = null;
  let bestWidth = width;
  let bestHeight = height;

  while (true) {
    let quality = INITIAL_JPEG_QUALITY;

    while (true) {
      const blob = await compressToCanvas(
        img,
        width,
        height,
        "image/jpeg",
        quality,
      );

      bestBlob = blob;
      bestWidth = width;
      bestHeight = height;

      if (blob.size <= maxSizeBytes) {
        return {
          blob,
          width,
          height,
          mimeType: "image/jpeg",
        };
      }

      const nextQuality = getNextQuality(quality);
      if (nextQuality === quality) {
        break;
      }
      quality = nextQuality;
    }

    const nextDimensions = reduceDimensions(width, height);
    if (nextDimensions.width === width && nextDimensions.height === height) {
      break;
    }

    width = nextDimensions.width;
    height = nextDimensions.height;
  }

  return {
    blob: bestBlob ?? (await compressToCanvas(img, width, height, "image/jpeg", MIN_JPEG_QUALITY)),
    width: bestWidth,
    height: bestHeight,
    mimeType: "image/jpeg",
  };
}

async function compressTransparentImage(
  img: HTMLImageElement,
  initialWidth: number,
  initialHeight: number,
  mimeType: string,
  maxSizeBytes: number,
): Promise<CompressedImage> {
  let width = initialWidth;
  let height = initialHeight;
  let bestBlob: Blob | null = null;
  let bestWidth = width;
  let bestHeight = height;

  while (true) {
    const blob = await compressToCanvas(img, width, height, mimeType, 1);
    bestBlob = blob;
    bestWidth = width;
    bestHeight = height;

    if (blob.size <= maxSizeBytes) {
      return {
        blob,
        width,
        height,
        mimeType,
      };
    }

    const nextDimensions = reduceDimensions(width, height);
    if (nextDimensions.width === width && nextDimensions.height === height) {
      break;
    }

    width = nextDimensions.width;
    height = nextDimensions.height;
  }

  return {
    blob: bestBlob ?? (await compressToCanvas(img, width, height, mimeType, 1)),
    width: bestWidth,
    height: bestHeight,
    mimeType,
  };
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Get dimensions of an image file without loading into canvas
 */
function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to get image dimensions"));
    };

    img.src = url;
  });
}

/**
 * Check if an image has transparency (alpha channel)
 */
async function imageHasTransparency(file: File): Promise<boolean> {
  // PNG and WebP can have transparency, JPEG cannot
  if (file.type === "image/png" || file.type === "image/webp") {
    // For PNG/WebP, actually check the pixels
    try {
      const img = await loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.width, 100); // Sample area only
      canvas.height = Math.min(img.height, 100);
      const ctx = canvas.getContext("2d");

      if (!ctx) return false;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check if any pixel has alpha < 255
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          return true;
        }
      }
    } catch {
      // If we can't check, assume no transparency
      return false;
    }
  }

  return false;
}

/**
 * Calculate target dimensions maintaining aspect ratio
 */
function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const aspectRatio = width / height;

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

function reduceDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  if (width <= MIN_DIMENSION && height <= MIN_DIMENSION) {
    return { width, height };
  }

  const nextWidth =
    width > MIN_DIMENSION
      ? Math.max(MIN_DIMENSION, Math.floor(width * DIMENSION_REDUCTION_FACTOR))
      : width;
  const nextHeight =
    height > MIN_DIMENSION
      ? Math.max(MIN_DIMENSION, Math.floor(height * DIMENSION_REDUCTION_FACTOR))
      : height;

  return {
    width: nextWidth,
    height: nextHeight,
  };
}

function getNextQuality(quality: number): number {
  if (quality <= MIN_JPEG_QUALITY) {
    return quality;
  }

  return Math.max(
    MIN_JPEG_QUALITY,
    Number((quality - JPEG_QUALITY_STEP).toFixed(2)),
  );
}

/**
 * Compress image using canvas
 */
function compressToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Failed to get canvas context"));
      return;
    }

    // Use better image smoothing for quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw image at target size
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      },
      mimeType,
      quality,
    );
  });
}
