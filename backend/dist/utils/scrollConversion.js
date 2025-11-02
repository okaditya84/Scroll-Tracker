/**
 * Scroll Distance Conversion Utility
 *
 * Converts pixel measurements to real-world distances using standard DPI conversion.
 * Based on the standard web assumption of 96 DPI (dots per inch).
 *
 * Conversion factors:
 * - 1 inch = 96 pixels (standard web DPI)
 * - 1 inch = 2.54 centimeters
 * - Therefore: 96 pixels = 2.54 cm
 * - 1 pixel = 2.54/96 = 0.02645833... cm
 */
const PIXELS_PER_INCH = 96;
const CM_PER_INCH = 2.54;
const CM_PER_PIXEL = CM_PER_INCH / PIXELS_PER_INCH; // 0.02645833...
const KM_PER_CM = 0.00001; // 1 km = 100,000 cm
/**
 * Convert pixels to centimeters
 * @param pixels - Distance in pixels
 * @returns Distance in centimeters
 */
export const pixelsToClimbometers = (pixels) => {
    if (!Number.isFinite(pixels) || pixels < 0) {
        return 0;
    }
    return pixels * CM_PER_PIXEL;
};
/**
 * Convert pixels to kilometers
 * @param pixels - Distance in pixels
 * @returns Distance in kilometers
 */
export const pixelsToKilometers = (pixels) => {
    if (!Number.isFinite(pixels) || pixels < 0) {
        return 0;
    }
    const cm = pixelsToClimbometers(pixels);
    return cm * KM_PER_CM;
};
/**
 * Format scroll distance for display
 * Shows best unit based on magnitude (cm for < 1 km, km for >= 1 km)
 * @param pixels - Distance in pixels
 * @returns Formatted string with value and unit
 */
export const formatScrollDistance = (pixels) => {
    if (!Number.isFinite(pixels) || pixels < 0) {
        return { value: '0', unit: 'cm', cm: 0, km: 0 };
    }
    const cm = pixelsToClimbometers(pixels);
    const km = pixelsToKilometers(pixels);
    // Use km if >= 0.1 km (100,000 cm), otherwise use cm
    if (km >= 0.1) {
        return {
            value: km.toFixed(2),
            unit: 'km',
            cm,
            km
        };
    }
    return {
        value: cm.toFixed(1),
        unit: 'cm',
        cm,
        km
    };
};
/**
 * Format scroll distance with both units for UI display
 * @param pixels - Distance in pixels
 * @returns String like "254.6 cm (2.55 km)" or "127.3 cm"
 */
export const formatScrollDistanceWithBoth = (pixels) => {
    if (!Number.isFinite(pixels) || pixels < 0) {
        return '0 cm';
    }
    const cm = pixelsToClimbometers(pixels);
    const km = pixelsToKilometers(pixels);
    // Show both if km is significant (>= 0.5 km)
    if (km >= 0.5) {
        return `${cm.toFixed(1)} cm (${km.toFixed(2)} km)`;
    }
    // Show just cm with km in parentheses if km is visible (>= 0.1 km)
    if (km >= 0.1) {
        return `${cm.toFixed(1)} cm (${km.toFixed(3)} km)`;
    }
    // Show just cm
    return `${cm.toFixed(1)} cm`;
};
/**
 * Get natural language description of scroll distance
 * Useful for insights and contextual messaging
 * @param pixels - Distance in pixels
 * @returns Human-readable description
 */
export const getScrollDistanceDescription = (pixels) => {
    const km = pixelsToKilometers(pixels);
    const cm = pixelsToClimbometers(pixels);
    if (km >= 1) {
        return `over ${km.toFixed(1)} kilometers`;
    }
    if (km >= 0.1) {
        return `${km.toFixed(2)} kilometers`;
    }
    if (cm >= 100) {
        return `over ${Math.round(cm / 100)} meters`;
    }
    if (cm >= 10) {
        return `${Math.round(cm)} centimeters`;
    }
    return `just under ${cm.toFixed(1)} centimeters`;
};
/**
 * Validate scroll distance value
 * @param value - Value to validate
 * @returns True if valid number >= 0
 */
export const isValidScrollDistance = (value) => {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
};
/**
 * Get complete scroll distance data with all formats
 * @param pixels - Distance in pixels
 * @returns Object with all conversion formats
 */
export const getScrollDistanceData = (pixels) => {
    const cm = pixelsToClimbometers(pixels);
    const km = pixelsToKilometers(pixels);
    return {
        pixels: Math.round(pixels),
        centimeters: Math.round(cm * 10) / 10, // Round to 0.1 cm
        kilometers: Math.round(km * 10000) / 10000, // Round to 0.0001 km
        formatted: formatScrollDistance(pixels).value,
        formattedWithBoth: formatScrollDistanceWithBoth(pixels),
        description: getScrollDistanceDescription(pixels)
    };
};
