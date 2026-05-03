// Tailwind v4 uses a dedicated PostCSS plugin (no separate tailwind.config.js needed).
// Theme customization lives in app/globals.css via @theme directive.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
