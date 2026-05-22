const colors = {
  bg: "var(--bg)",
  "bg-elevated": "var(--bg-elevated)",
  "bg-muted": "var(--bg-muted)",
  surface: "var(--surface)",
  border: "var(--border)",
  "border-strong": "var(--border-strong)",
  text: "var(--text)",
  "text-secondary": "var(--text-secondary)",
  "text-tertiary": "var(--text-tertiary)",
  accent: {
    DEFAULT: "#5B5FE0",
    600: "#4a4ed1",
    700: "#3d40b8",
    soft: "#ECEDFB",
    softer: "#F4F5FC",
  },
  gray: {
    0: "#FFFFFF",
    25: "#FBFBFC",
    50: "#F6F6F8",
    100: "#EFEFF2",
    150: "#E5E5EA",
    200: "#D7D7DD",
    300: "#BCBCC5",
    400: "#9494A0",
    500: "#6F6F7B",
    600: "#4F4F5A",
    700: "#38383F",
    800: "#25252A",
    900: "#131318",
  },
  success: "#2F8F5E",
  warning: "#B57315",
  danger: "#C13B3B",
};

const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
};

const radius = {
  sm: "8px",
  md: "10px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  pill: "999px",
};

const screens = {
  xs: "360px",
  sm: "414px",
  md: "769px",
  lg: "1024px",
};

export const wafliTokens = {
  colors,
  spacing,
  radius,
  screens,
  fontFamily: {
    sans: ["Geist", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
    mono: ["Geist Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
  },
};

export default wafliTokens;
