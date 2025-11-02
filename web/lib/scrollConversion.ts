/**
 * Scroll Distance Conversion Utility (Web)
 * 
 * Client-side conversions for the web dashboard.
 * Based on standard 96 DPI web conversion.
 */

const PIXELS_PER_INCH = 96;
const CM_PER_INCH = 2.54;
const CM_PER_PIXEL = CM_PER_INCH / PIXELS_PER_INCH;
const KM_PER_CM = 0.00001;

/**
 * Convert pixels to centimeters
 */
export const pixelsToClimbometers = (pixels: number): number => {
  if (!Number.isFinite(pixels) || pixels < 0) return 0;
  return pixels * CM_PER_PIXEL;
};

/**
 * Convert pixels to kilometers
 */
export const pixelsToKilometers = (pixels: number): number => {
  if (!Number.isFinite(pixels) || pixels < 0) return 0;
  const cm = pixelsToClimbometers(pixels);
  return cm * KM_PER_CM;
};

/**
 * Format scroll distance intelligently (cm for small values, km for large)
 */
export const formatScrollDistance = (pixels: number): string => {
  if (!Number.isFinite(pixels) || pixels < 0) return '0 cm';

  const km = pixelsToKilometers(pixels);
  const cm = pixelsToClimbometers(pixels);

  if (km >= 0.1) {
    return km >= 1 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
  }

  return `${cm.toFixed(0)} cm`;
};

/**
 * Format scroll distance with both units for tooltips
 */
export const formatScrollDistanceDetailed = (pixels: number): string => {
  if (!Number.isFinite(pixels) || pixels < 0) return '0 cm';

  const cm = pixelsToClimbometers(pixels);
  const km = pixelsToKilometers(pixels);

  if (km >= 0.5) {
    return `${cm.toFixed(0)} cm (${km.toFixed(2)} km)`;
  }

  if (km >= 0.1) {
    return `${cm.toFixed(0)} cm (${km.toFixed(3)} km)`;
  }

  return `${cm.toFixed(0)} cm`;
};

/**
 * Get scroll distance data for direct use in components
 */
export const getScrollDistanceData = (pixels: number) => {
  const cm = pixelsToClimbometers(pixels);
  const km = pixelsToKilometers(pixels);

  return {
    pixels: Math.round(pixels),
    cm: Math.round(cm * 10) / 10,
    km: Math.round(km * 10000) / 10000,
    formatted: formatScrollDistance(pixels),
    detailed: formatScrollDistanceDetailed(pixels),
    display: km >= 0.1 ? `${km.toFixed(2)} km` : `${cm.toFixed(0)} cm`,
    displayWithPixels: `${Math.round(pixels / 1000)}k px (${formatScrollDistance(pixels)})`
  };
};

/**
 * Get units for display based on value
 */
export const getScrollDistanceUnit = (pixels: number): { value: string; unit: string } => {
  const km = pixelsToKilometers(pixels);

  if (km >= 0.1) {
    return { value: km.toFixed(2), unit: 'km' };
  }

  const cm = pixelsToClimbometers(pixels);
  return { value: cm.toFixed(0), unit: 'cm' };
};
