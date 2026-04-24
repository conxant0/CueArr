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

async function decodeAllQRCodes(imageDataUrl) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = imageDataUrl;
  });

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const results = [];
  while (true) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (!code) break;

    results.push(extractResult(code, dpr));

    // Mask the found QR code so the next iteration can find additional ones
    const { minX, minY, maxX, maxY } = getBoundingBox(code.location);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  }

  return results;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DECODE_QR') {
    decodeAllQRCodes(message.imageDataUrl).then(sendResponse);
    return true;
  }
  return false;
});

if (typeof module !== 'undefined') {
  module.exports = { extractResult, getBoundingBox, decodeAllQRCodes };
}
