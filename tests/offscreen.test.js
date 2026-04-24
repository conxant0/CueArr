global.chrome = { runtime: { onMessage: { addListener: jest.fn() } } };
global.jsQR = jest.fn();
global.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height != null ? height : Math.floor(data.length / 4 / width);
  }
};

const { extractResult, getBoundingBox, adaptiveThreshold } = require('../offscreen');

describe('extractResult', () => {
  test('extracts data and top-left coordinates with dpr', () => {
    const code = {
      data: 'https://example.com',
      location: {
        topLeftCorner:     { x: 100, y: 200 },
        topRightCorner:    { x: 200, y: 200 },
        bottomLeftCorner:  { x: 100, y: 300 },
        bottomRightCorner: { x: 200, y: 300 }
      }
    };
    expect(extractResult(code, 2)).toEqual({
      data: 'https://example.com',
      topLeftX: 100,
      topLeftY: 200,
      devicePixelRatio: 2
    });
  });
});

describe('getBoundingBox', () => {
  test('returns min/max bounds from all four corners', () => {
    const location = {
      topLeftCorner:     { x: 10,  y: 20  },
      topRightCorner:    { x: 110, y: 22  },
      bottomLeftCorner:  { x: 8,   y: 120 },
      bottomRightCorner: { x: 112, y: 118 }
    };
    expect(getBoundingBox(location)).toEqual({
      minX: 8, minY: 20, maxX: 112, maxY: 120
    });
  });

  test('floors minX/minY and ceils maxX/maxY for sub-pixel coordinates', () => {
    const location = {
      topLeftCorner:     { x: 10.4,  y: 20.6  },
      topRightCorner:    { x: 110.7, y: 20.6  },
      bottomLeftCorner:  { x: 10.4,  y: 120.3 },
      bottomRightCorner: { x: 110.7, y: 120.3 }
    };
    const box = getBoundingBox(location);
    expect(box.minX).toBe(10);
    expect(box.minY).toBe(20);
    expect(box.maxX).toBe(111);
    expect(box.maxY).toBe(121);
  });
});

describe('adaptiveThreshold', () => {
  function makeImageData(pixels, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i++) {
      data[i * 4]     = pixels[i];
      data[i * 4 + 1] = pixels[i];
      data[i * 4 + 2] = pixels[i];
      data[i * 4 + 3] = 255;
    }
    return { data, width, height };
  }

  test('returns ImageData with same dimensions', () => {
    const input = makeImageData(new Array(4 * 4).fill(128), 4, 4);
    const result = adaptiveThreshold(input);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.data.length).toBe(4 * 4 * 4);
  });

  test('dark pixel surrounded by bright pixels becomes black', () => {
    // 5x5 image: all white (200) except center pixel which is very dark (10)
    const pixels = new Array(25).fill(200);
    pixels[12] = 10;
    const input = makeImageData(pixels, 5, 5);
    const result = adaptiveThreshold(input);
    // Center pixel should be binarized to black (0)
    expect(result.data[12 * 4]).toBe(0);
  });

  test('uniform grey image produces all-white output (no local contrast)', () => {
    const pixels = new Array(16).fill(128);
    const input = makeImageData(pixels, 4, 4);
    const result = adaptiveThreshold(input);
    // Every pixel equals local average, so none cross the threshold → all white
    for (let i = 0; i < 16; i++) {
      expect(result.data[i * 4]).toBe(255);
    }
  });
});
