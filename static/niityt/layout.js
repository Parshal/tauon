const EPSILON = 1e-6;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computeSquareLayout(width = 0, height = 0) {
  const safeWidth = Math.max(1, Math.floor(width) || 1);
  const safeHeight = Math.max(1, Math.floor(height) || 1);
  const squareSize = Math.min(safeWidth, safeHeight);
  const horizontalPadding = (safeWidth - squareSize) * 0.5;
  const verticalPadding = (safeHeight - squareSize) * 0.5;
  const playMinX = horizontalPadding / safeWidth;
  const playMaxX = 1 - playMinX;
  const playMinY = verticalPadding / safeHeight;
  const playMaxY = 1 - playMinY;

  return {
    width: safeWidth,
    height: safeHeight,
    squareSize,
    playMinX,
    playMaxX,
    playMinY,
    playMaxY,
    playSizeX: Math.max(EPSILON, playMaxX - playMinX),
    playSizeY: Math.max(EPSILON, playMaxY - playMinY),
    gutterLeft: playMinX,
    gutterRight: Math.max(EPSILON, 1 - playMaxX),
    gutterTop: playMinY,
    gutterBottom: Math.max(EPSILON, 1 - playMaxY)
  };
}

export function mapScreenToSquare(u, v, layout) {
  if (!layout) return null;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;

  const clampedU = clamp(u, layout.playMinX, layout.playMaxX);
  const clampedV = clamp(v, layout.playMinY, layout.playMaxY);
  const insideX = u >= layout.playMinX && u <= layout.playMaxX;
  const insideY = v >= layout.playMinY && v <= layout.playMaxY;

  const squareU = (clampedU - layout.playMinX) / layout.playSizeX;
  const squareV = (clampedV - layout.playMinY) / layout.playSizeY;

  return {
    u: squareU,
    v: squareV,
    inside: insideX && insideY
  };
}
