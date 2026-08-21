export interface ViewportLayout {
  compactLandscape: boolean;
  isNarrow: boolean;
  centreScale: number;
  centreYRatio: number;
  aiZoneScale: number;
  aiSideInset: number;
  handScale: number;
  handOverlapRatio: number;
  handLiftRatio: number;
  activityLogHeight: number;
  actionBottom: number;
  ledScale: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Shared layout policy for the Phaser table and the React HUD.
 *
 * Short landscape screens cannot fit the full decorative table vertically, so
 * they use a compact play surface: smaller cards/zones, no off-screen card
 * peek, and HUD actions in the free right rail instead of over the hand.
 */
export function getViewportLayout(width: number, height: number): ViewportLayout {
  const compactLandscape = height <= 620 && width > height;
  const isNarrow = width < 700;

  if (compactLandscape) {
    return {
      compactLandscape,
      isNarrow,
      centreScale: clamp(height / 900, 0.4, 0.6),
      centreYRatio: 0.48,
      aiZoneScale: clamp(height / 750, 0.5, 0.72),
      aiSideInset: clamp(width * 0.285, 175, 210),
      handScale: clamp(height / 750, 0.48, 0.68),
      handOverlapRatio: 0.56,
      handLiftRatio: 0.12,
      activityLogHeight: 36,
      actionBottom: 40,
      ledScale: clamp(height / 650, 0.55, 0.82),
    };
  }

  return {
    compactLandscape,
    isNarrow,
    centreScale: 1,
    centreYRatio: 0.46,
    aiZoneScale: 1,
    aiSideInset: 130,
    handScale: width < 768 ? 0.85 : 1.25,
    handOverlapRatio: width < 768 ? 0.46 : 0.56,
    handLiftRatio: 0.28,
    activityLogHeight: 36,
    actionBottom: isNarrow ? 225 : 72,
    ledScale: 1,
  };
}

/** Bounds used by tests and future layout diagnostics. */
export function getCompactBoardBands(width: number, height: number) {
  const layout = getViewportLayout(width, height);
  const centreHalfHeight = 100 * layout.centreScale;
  const handHalfHeight = 105 * layout.handScale;
  const handCentreY = height - layout.activityLogHeight - handHalfHeight - 4;

  return {
    aiBottom: height * 0.18 + 54 * layout.aiZoneScale,
    centreTop: height * layout.centreYRatio - centreHalfHeight,
    centreBottom: height * layout.centreYRatio + centreHalfHeight,
    handTop: handCentreY - handHalfHeight,
    handBottom: handCentreY + handHalfHeight,
  };
}
