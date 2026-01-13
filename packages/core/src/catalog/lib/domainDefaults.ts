// Updated hem allowances (Task 904)
// top: 5cm fixed, bottom: dynamic (2cm or 10cm from user choice), side: 2cm per edge, stitch: 2cm per stitch line
export const DEFAULT_ALLOWANCES_CM = { top: 5, bottom: 10, side: 2, stitch: 2 } as const;
export const DEFAULT_SHRINKAGE_PCT = 2;

// Updated pleat IDs (Task 904): flex (was microflex), tab (was tape), ring (new)
export const DEFAULT_FULLNESS_BY_PLEAT: Record<string, number> = {
  wave: 2.2,
  flex: 2.4,
  ring: 2.1,
  tunnel: 1.8,
  tab: 2.0,
};

export const DEFAULT_MIN_ORDER_INCREMENT_CM = 10;

// Labor per width in minor currency units
export const DEFAULT_LABOR_PER_WIDTH_MINOR: Record<string, number> = {
  wave: 800,
  flex: 900,
  ring: 750,
  tunnel: 600,
  tab: 700,
};

export const DEFAULT_READY_HEIGHT_CM = 240;
