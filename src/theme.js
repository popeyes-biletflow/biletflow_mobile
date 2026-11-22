// Tailwind palette values used by biletflow_web (gray / blue-600 / emerald / red / amber),
// so the mobile app looks like the web app.
export const colors = {
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  emerald50: "#ecfdf5",
  emerald100: "#d1fae5",
  emerald500: "#10b981",
  emerald600: "#059669",
  emerald700: "#047857",
  emerald800: "#065f46",
  red50: "#fef2f2",
  red100: "#fee2e2",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  amber50: "#fffbeb",
  amber100: "#fef3c7",
  amber500: "#f59e0b",
  amber800: "#92400e"
};

// Notice tones: same pairs as the web alerts (bg-*-50/100 + text-*-700/800).
export const tones = {
  success: { bg: colors.emerald50, border: colors.emerald500, text: colors.emerald800, strong: colors.emerald700 },
  error: { bg: colors.red50, border: colors.red500, text: colors.red700, strong: colors.red700 },
  warning: { bg: colors.amber50, border: colors.amber500, text: colors.amber800, strong: colors.amber800 },
  info: { bg: colors.blue50, border: colors.blue500, text: colors.blue700, strong: colors.blue700 }
};

// shadow-sm / shadow-md
export const shadow = {
  sm: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3 }
};
