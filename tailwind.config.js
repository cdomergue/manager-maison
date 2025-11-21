/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: "class", // Active le mode sombre via la classe 'dark'
  theme: {
    extend: {
      colors: {
        // Couleurs personnalisées pour le mode sombre
        dark: {
          bg: "#0f172a",
          surface: "#1e293b",
          card: "#334155",
          text: "#f1f5f9",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
