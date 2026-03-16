// @vitest-environment jsdom
import { compressImage } from "../utils/imageCompression";

interface CompressionCall {
  width: number;
  height: number;
  mimeType: string;
  quality: number;
}

let mockImageWidth = 0;
let mockImageHeight = 0;
let mockHasTransparency = false;
let compressionCalls: CompressionCall[] = [];
let blobSizeFactory: (call: CompressionCall & { callIndex: number }) => number =
  () => 1;

const originalCreateElement = document.createElement.bind(document);
const originalImage = globalThis.Image;
const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

class MockImage {
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    this.width = mockImageWidth;
    this.height = mockImageHeight;
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

function makeFile(size: number, type: string, name: string): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function installCanvasMock() {
  vi.spyOn(document, "createElement").mockImplementation(
    ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() !== "canvas") {
        return originalCreateElement(tagName, options);
      }

      const state = { width: 0, height: 0 };
      const context = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(
            mockHasTransparency ? [0, 0, 0, 120] : [0, 0, 0, 255],
          ),
        })),
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
      };

      return {
        get width() {
          return state.width;
        },
        set width(value: number) {
          state.width = value;
        },
        get height() {
          return state.height;
        },
        set height(value: number) {
          state.height = value;
        },
        getContext: vi.fn(() => context),
        toBlob: (
          callback: BlobCallback,
          mimeType?: string,
          quality?: number,
        ) => {
          const call = {
            width: state.width,
            height: state.height,
            mimeType: mimeType ?? "application/octet-stream",
            quality: quality ?? 1,
          };
          compressionCalls.push(call);
          const size = blobSizeFactory({
            ...call,
            callIndex: compressionCalls.length - 1,
          });
          callback(
            new Blob([new ArrayBuffer(size)], {
              type: call.mimeType,
            }),
          );
        },
      } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement,
  );
}

beforeAll(() => {
  vi.stubGlobal("Image", MockImage as unknown as typeof Image);
  globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  globalThis.Image = originalImage;
  globalThis.URL.createObjectURL = originalCreateObjectURL;
  globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
});

beforeEach(() => {
  mockImageWidth = 0;
  mockImageHeight = 0;
  mockHasTransparency = false;
  compressionCalls = [];
  blobSizeFactory = () => 1;
  installCanvasMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compressImage", () => {
  it("leaves small images unchanged", async () => {
    mockImageWidth = 640;
    mockImageHeight = 480;
    const file = makeFile(32 * 1024, "image/jpeg", "small.jpg");

    const result = await compressImage(file);

    expect(result.blob).toBe(file);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.mimeType).toBe("image/jpeg");
    expect(compressionCalls).toHaveLength(0);
  });

  it("downscales large opaque photos below the old dimension ceiling", async () => {
    mockImageWidth = 4000;
    mockImageHeight = 3000;
    blobSizeFactory = ({ width, height, quality, mimeType }) =>
      Math.round(
        width * height * (mimeType === "image/jpeg" ? quality : 1) * 0.25,
      );
    const file = makeFile(3_900_000, "image/jpeg", "photo.jpg");

    const result = await compressImage(file);

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.blob.size).toBeLessThanOrEqual(750 * 1024);
    expect(result.width).toBeLessThan(3000);
    expect(result.height).toBeLessThan(3000);
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1500);
  });

  it("keeps iterating until it reaches the tighter target", async () => {
    mockImageWidth = 2800;
    mockImageHeight = 2100;
    blobSizeFactory = ({ width, height }) => Math.round(width * height * 0.5);
    const file = makeFile(5_000_000, "image/jpeg", "huge-photo.jpg");

    const result = await compressImage(file);

    expect(result.blob.size).toBeLessThanOrEqual(750 * 1024);
    expect(result.width).toBeLessThan(2000);
    expect(result.height).toBeLessThan(1500);
    expect(compressionCalls.length).toBeGreaterThan(3);
  });

  it("preserves transparency-safe output while still reducing dimensions", async () => {
    mockImageWidth = 3600;
    mockImageHeight = 2400;
    mockHasTransparency = true;
    blobSizeFactory = ({ width, height }) => Math.round(width * height * 0.22);
    const file = makeFile(3_200_000, "image/png", "transparent.png");

    const result = await compressImage(file);

    expect(result.mimeType).toBe("image/png");
    expect(result.blob.size).toBeLessThanOrEqual(750 * 1024);
    expect(result.width).toBeLessThan(3000);
    expect(result.height).toBeLessThan(3000);
    expect(compressionCalls.every((call) => call.quality === 1)).toBe(true);
  });
});
