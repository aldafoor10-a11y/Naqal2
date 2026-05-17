/**
 * NAQAL GO - Theme tokens (colors, spacing, typography)
 */
export const colors = {
  // Brand
  gold: '#D4A437',
  goldLight: '#E8C063',
  goldDark: '#A8821D',
  darkBrown: '#3D2817',
  // Backgrounds
  appBg: '#0D0907',
  surface1: '#1A120C',
  surface2: '#281C13',
  surface3: '#3D2817',
  overlay: 'rgba(13, 9, 7, 0.75)',
  // Text
  textPrimary: '#F5F0E6',
  textSecondary: '#A69C92',
  textOnBrand: '#0D0907',
  textDisabled: '#5A524A',
  // Status
  success: '#34C759',
  warning: '#FF9F0A',
  error: '#FF453A',
  info: '#0A84FF',
  // Borders
  border: '#3D2817',
  borderLight: '#281C13',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '700' as const, lineHeight: 24 },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  button: {
    shadowColor: '#D4A437',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};
