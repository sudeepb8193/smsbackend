export interface ColorContrastCheckResult {
  hex: string;
  isValidHex: boolean;
  contrastRatioWhite: number;
  contrastRatioBlack: number;
  contrastWarning: boolean;
  recommendedTextColor: 'white' | 'black';
}

/**
 * Calculate relative luminance of an RGB component (0 to 255)
 */
function getLinearRGB(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance of a 6-digit hex color according to WCAG 2.1
 */
export function calculateLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '').trim();
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  const rLin = getLinearRGB(r);
  const gLin = getLinearRGB(g);
  const bLin = getLinearRGB(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculate contrast ratio between two luminance values (1 to 21)
 */
export function calculateContrastRatio(lum1: number, lum2: number): number {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return Number(((l1 + 0.05) / (l2 + 0.05)).toFixed(2));
}

/**
 * Validate hex color and check WCAG AA contrast ratio against white (#FFFFFF) and black (#000000)
 */
export function checkColorContrast(hex: string): ColorContrastCheckResult {
  const hexRegex = /^#([A-Fa-f0-9]{6})$/;
  const normalizedHex = hex.startsWith('#')
    ? hex.toUpperCase()
    : `#${hex.toUpperCase()}`;

  if (!hexRegex.test(normalizedHex)) {
    return {
      hex: normalizedHex,
      isValidHex: false,
      contrastRatioWhite: 0,
      contrastRatioBlack: 0,
      contrastWarning: true,
      recommendedTextColor: 'white',
    };
  }

  const colorLum = calculateLuminance(normalizedHex);
  const whiteLum = 1.0;
  const blackLum = 0.0;

  const contrastWhite = calculateContrastRatio(colorLum, whiteLum);
  const contrastBlack = calculateContrastRatio(colorLum, blackLum);

  // Recommended text color is whichever has higher contrast
  const recommendedTextColor =
    contrastWhite >= contrastBlack ? 'white' : 'black';
  const bestContrast = Math.max(contrastWhite, contrastBlack);

  // WCAG AA expectation for normal text is 4.5:1
  const contrastWarning = bestContrast < 4.5;

  return {
    hex: normalizedHex,
    isValidHex: true,
    contrastRatioWhite: contrastWhite,
    contrastRatioBlack: contrastBlack,
    contrastWarning,
    recommendedTextColor,
  };
}
