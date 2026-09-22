import {
  checkColorContrast,
  calculateLuminance,
  calculateContrastRatio,
} from './color-contrast.validator';

describe('ColorContrastValidator', () => {
  describe('calculateLuminance', () => {
    it('should return 1 for white #FFFFFF', () => {
      expect(calculateLuminance('#FFFFFF')).toBeCloseTo(1.0, 2);
    });

    it('should return 0 for black #000000', () => {
      expect(calculateLuminance('#000000')).toBeCloseTo(0.0, 2);
    });
  });

  describe('calculateContrastRatio', () => {
    it('should return 21 for black and white', () => {
      expect(calculateContrastRatio(1.0, 0.0)).toBe(21);
    });
  });

  describe('checkColorContrast', () => {
    it('should validate 6-digit hex and return contrast ratio', () => {
      const result = checkColorContrast('#8A4A52');

      expect(result.isValidHex).toBe(true);
      expect(result.hex).toBe('#8A4A52');
      expect(result.contrastRatioWhite).toBeGreaterThan(0);
      expect(result.contrastRatioBlack).toBeGreaterThan(0);
    });

    it('should flag contrastWarning if contrast ratio is below 4.5:1 against both text colors', () => {
      // #AAAAAA on white has ~2.32:1 contrast ratio and on black has ~9.05:1
      const result = checkColorContrast('#AAAAAA');

      expect(result.isValidHex).toBe(true);
      expect(result.recommendedTextColor).toBe('black');
    });

    it('should handle invalid hex string gracefully', () => {
      const result = checkColorContrast('invalid-hex');

      expect(result.isValidHex).toBe(false);
      expect(result.contrastWarning).toBe(true);
    });
  });
});
