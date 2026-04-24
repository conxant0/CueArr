global.chrome = { runtime: { onMessage: { addListener: jest.fn() } } };
global.jsQR = jest.fn();

const { extractResult, getBoundingBox } = require('../offscreen');

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
