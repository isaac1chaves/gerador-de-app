const { screen } = require('electron');
const {
  BASE_WIDTH,
  INITIAL_CONTENT_HEIGHT,
  MIN_CONTENT_HEIGHT,
  MAX_CONTENT_HEIGHT,
  MIN_SCALE,
  MAX_SCALE,
  MIN_WINDOW_WIDTH
} = require('./config');

function clamp(number, min, max = Infinity) {
  return Math.max(min, Math.min(max, number));
}

function normalizeBaseHeight(value) {
  const number = Number(value || INITIAL_CONTENT_HEIGHT);
  return clamp(Math.round(number), MIN_CONTENT_HEIGHT, MAX_CONTENT_HEIGHT);
}

function getWindowScale(bounds) {
  return clamp(bounds.width / BASE_WIDTH, MIN_SCALE, MAX_SCALE);
}

function getScaledBounds(baseBounds, edge, dx, dy, baseContentHeight) {
  const logicalHeight = normalizeBaseHeight(baseContentHeight);
  const horizontalScale = edge.includes('right')
    ? (baseBounds.width + dx) / BASE_WIDTH
    : edge.includes('left')
      ? (baseBounds.width - dx) / BASE_WIDTH
      : null;
  const verticalScale = edge.includes('bottom')
    ? (baseBounds.height + dy) / logicalHeight
    : edge.includes('top')
      ? (baseBounds.height - dy) / logicalHeight
      : null;

  let scale = horizontalScale ?? verticalScale ?? getWindowScale(baseBounds);
  if (horizontalScale !== null && verticalScale !== null) {
    const currentScale = getWindowScale(baseBounds);
    scale = Math.abs(horizontalScale - currentScale) >= Math.abs(verticalScale - currentScale)
      ? horizontalScale
      : verticalScale;
  }

  scale = clamp(scale, MIN_SCALE, MAX_SCALE);
  const width = Math.max(MIN_WINDOW_WIDTH, Math.round(BASE_WIDTH * scale));
  const height = Math.round(logicalHeight * scale);
  let x = baseBounds.x;
  let y = baseBounds.y;

  if (edge.includes('left') && !edge.includes('right')) x += baseBounds.width - width;
  if (edge.includes('top') && !edge.includes('bottom')) y += baseBounds.height - height;

  return { x, y, width, height, scale: width / BASE_WIDTH };
}

function getDisplayWorkArea(bounds) {
  const display = screen.getDisplayMatching(bounds);
  if (display?.workArea) return display.workArea;
  const primary = screen.getPrimaryDisplay();
  return { x: 0, y: 0, width: primary.workAreaSize.width, height: primary.workAreaSize.height };
}

module.exports = { clamp, normalizeBaseHeight, getWindowScale, getScaledBounds, getDisplayWorkArea };
