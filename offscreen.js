const BLOCK_SIZE_DENOMINATOR = 48;
const ADAPTIVE_THRESHOLD_SENSITIVITY = 0.88;
const DOWNSAMPLE_PIXEL_THRESHOLD = 2_000_000;
const DEBUG_DUMP = false;

function extractResult(code, dpr) {
  return {
    data: code.data,
    topLeftX: code.location.topLeftCorner.x,
    topLeftY: code.location.topLeftCorner.y,
    devicePixelRatio: dpr
  };
}

function getBoundingBox(location) {
  const corners = [
    location.topLeftCorner,
    location.topRightCorner,
    location.bottomLeftCorner,
    location.bottomRightCorner
  ];
  return {
    minX: Math.floor(Math.min(...corners.map(c => c.x))),
    minY: Math.floor(Math.min(...corners.map(c => c.y))),
    maxX: Math.ceil(Math.max(...corners.map(c => c.x))),
    maxY: Math.ceil(Math.max(...corners.map(c => c.y)))
  };
}

// Converts image pixels to grayscale values.
function toGrayscale(data, count) {
  const gray = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  return gray;
}

// Applies adaptive local thresholding using a summed-area table (integral image).
// For each pixel, compares its brightness to the average of a local block rather
// than a single global threshold — this is why phone scanners handle photos of
// printed QR codes far better than a global binarizer like jsQR's default.
function adaptiveThreshold(imageData) {
  const { width, height, data } = imageData;
  const gray = toGrayscale(data, width * height);

  // Build integral image for O(1) rectangular sum queries.
  const W = width + 1;
  const integral = new Float64Array(W * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      integral[(y + 1) * W + (x + 1)] =
        gray[y * width + x] +
        integral[y * W + (x + 1)] +
        integral[(y + 1) * W + x] -
        integral[y * W + x];
    }
  }

  // Block half-size: large enough to span several QR modules so local average
  // captures both black and white regions, giving a meaningful local threshold.
  const half = Math.max(16, Math.floor(Math.min(width, height) / BLOCK_SIZE_DENOMINATOR));

  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half), y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half), y2 = Math.min(height - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * W + (x2 + 1)] -
        integral[y1 * W + (x2 + 1)] -
        integral[(y2 + 1) * W + x1] +
        integral[y1 * W + x1];
      // A pixel is "black" when it is meaningfully darker than its local average.
      const val = gray[y * width + x] < (sum / count) * ADAPTIVE_THRESHOLD_SENSITIVITY ? 0 : 255;
      const i = (y * width + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = val;
      out[i + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}

// Scans the current canvas state for all QR codes, masking each found one
// so subsequent iterations can find additional codes on the same image.
function scanAll(ctx, width, height, dpr) {
  const results = [];
  while (true) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (!code) break;
    results.push(extractResult(code, dpr));
    const { minX, minY, maxX, maxY } = getBoundingBox(code.location);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  }
  return results;
}

async function decodeAllQRCodes(imageDataUrl) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load screenshot image'));
    img.src = imageDataUrl;
  });

  canvas.width = img.width;
  canvas.height = img.height;

  let scanCtx = ctx;
  let scanWidth = canvas.width;
  let scanHeight = canvas.height;

  if (canvas.width * canvas.height > DOWNSAMPLE_PIXEL_THRESHOLD) {
    const secondary = document.createElement('canvas');
    secondary.width = Math.round(canvas.width / dpr);
    secondary.height = Math.round(canvas.height / dpr);
    scanCtx = secondary.getContext('2d', { willReadFrequently: true });
    scanWidth = secondary.width;
    scanHeight = secondary.height;
  }

  const debugDumps = [];

  // Draw fresh screenshot into scan canvas. Shared input for Pass 0 and Pass 1.
  scanCtx.drawImage(img, 0, 0, scanWidth, scanHeight);
  if (DEBUG_DUMP) debugDumps.push({ label: 'pass0/1-input', dataUrl: scanCtx.canvas.toDataURL('image/png') });

  // Pass 0: native BarcodeDetector. Typically more tolerant of anti-aliased /
  // sub-pixel-rendered modules (e.g. PDF viewer at low zoom) than jsQR.
  // Falls through if the API is unsupported or finds nothing.
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(scanCtx.canvas);
      if (codes.length > 0) {
        return codes.map(c => ({
          data: c.rawValue,
          topLeftX: c.cornerPoints[0].x,
          topLeftY: c.cornerPoints[0].y,
          devicePixelRatio: dpr
        }));
      }
    } catch {
      // Swallow and fall through to the jsQR passes.
    }
  }

  // Pass 1: jsQR on the same raw screenshot.
  const firstPass = scanAll(scanCtx, scanWidth, scanHeight, dpr);
  if (firstPass.length > 0) return firstPass;

  // Pass 2: redraw original and apply adaptive thresholding before scanning.
  // Handles QR codes in photos where the modules are not pure black/white
  // (e.g. photos of printed flyers, screenshots of images with noise).
  scanCtx.drawImage(img, 0, 0, scanWidth, scanHeight);
  const thresholded = adaptiveThreshold(scanCtx.getImageData(0, 0, scanWidth, scanHeight));
  scanCtx.putImageData(thresholded, 0, 0);
  if (DEBUG_DUMP) debugDumps.push({ label: 'pass2-input', dataUrl: scanCtx.canvas.toDataURL('image/png') });
  const secondPass = scanAll(scanCtx, scanWidth, scanHeight, dpr);
  if (secondPass.length > 0) return secondPass;

  // Pass 3: 2× nearest-neighbor upscale of the binarized image from pass 2.
  // Binarized pixels upscale without blur, giving jsQR more pixels per module
  // to detect QR codes that are too small at lower zoom levels (e.g. PDFs at 67%).
  // Skipped on large scan images where a 2× upscale would exceed memory/time budget.
  if (scanWidth * scanHeight <= DOWNSAMPLE_PIXEL_THRESHOLD) {
    const upCanvas = document.createElement('canvas');
    upCanvas.width = scanWidth * 2;
    upCanvas.height = scanHeight * 2;
    const upCtx = upCanvas.getContext('2d', { willReadFrequently: true });
    upCtx.imageSmoothingEnabled = false;
    upCtx.drawImage(scanCtx.canvas, 0, 0, upCanvas.width, upCanvas.height);
    if (DEBUG_DUMP) debugDumps.push({ label: 'pass3-input', dataUrl: upCanvas.toDataURL('image/png') });
    const thirdPass = scanAll(upCtx, upCanvas.width, upCanvas.height, dpr);
    if (thirdPass.length > 0) {
      return thirdPass.map(r => ({ ...r, topLeftX: r.topLeftX / 2, topLeftY: r.topLeftY / 2 }));
    }
  }

  if (DEBUG_DUMP) {
    chrome.runtime.sendMessage({
      type: 'DEBUG_DUMP',
      meta: { scanWidth, scanHeight, dpr, srcWidth: canvas.width, srcHeight: canvas.height },
      dumps: debugDumps
    }).catch(() => {});
  }
  return [];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DECODE_QR') {
    decodeAllQRCodes(message.imageDataUrl).then(sendResponse);
    return true;
  }
  return false;
});

if (typeof module === 'undefined') {
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' });
}

if (typeof module !== 'undefined') {
  module.exports = { extractResult, getBoundingBox, adaptiveThreshold, decodeAllQRCodes };
}
