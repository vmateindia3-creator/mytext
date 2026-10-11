/**
 * Runtime configuration.
 * Set EXPO_PUBLIC_API_URL in your .env file (see .env.example).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export const COLORS = {
  bg: '#0B1220',
  surface: '#151E31',
  surfaceAlt: '#1E293B',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  bubbleOut: '#2563EB',
  bubbleIn: '#1E293B',
  border: '#243049',
  danger: '#EF4444',
  success: '#22C55E',
};
