import wafliTokens from "./design-tokens.js";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    screens: wafliTokens.screens,
    extend: {
      colors: wafliTokens.colors,
      spacing: wafliTokens.spacing,
      borderRadius: wafliTokens.radius,
      fontFamily: wafliTokens.fontFamily,
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};
