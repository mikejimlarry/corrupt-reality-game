import { describe, expect, it } from 'vitest';
import { getCompactBoardBands, getViewportLayout } from './layout';

describe('responsive table layout', () => {
  it.each([
    ['small phone landscape', 667, 375],
    ['short phone landscape', 896, 414],
    ['compact tablet landscape', 1024, 576],
  ])('keeps gameplay bands separated at %s (%d x %d)', (_label, width, height) => {
    const layout = getViewportLayout(width, height);
    const bands = getCompactBoardBands(width, height);

    expect(layout.compactLandscape).toBe(true);
    expect(bands.aiBottom).toBeLessThan(bands.centreTop);
    expect(bands.centreBottom).toBeLessThan(bands.handTop);
    expect(bands.handBottom).toBeLessThanOrEqual(height - layout.activityLogHeight);
  });

  it.each([
    ['phone portrait', 390, 844],
    ['desktop', 1280, 720],
  ])('preserves the full table presentation at %s (%d x %d)', (_label, width, height) => {
    expect(getViewportLayout(width, height).compactLandscape).toBe(false);
  });

  it('reserves the right action rail on compact landscape screens', () => {
    const layout = getViewportLayout(667, 375);

    expect(layout.actionBottom).toBeGreaterThanOrEqual(layout.activityLogHeight);
    expect(layout.handScale).toBeLessThan(0.7);
    expect(layout.handLiftRatio).toBeLessThan(0.2);
  });
});
