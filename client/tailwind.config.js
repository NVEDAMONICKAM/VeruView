/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'media', // auto-detects system dark mode preference
  theme: {
    extend: {
      colors: {
        veru: {
          light:  '#D4EDDA',
          mid:    '#A8D5B5',
          accent: '#6BAF8C',
          dark:   '#3A7D5C',
          deeper: '#2A5E42',
        },
        earth: {
          // Warm Sand — alternate card bg, sidebar panels
          sand:       '#F5ECD7',
          sandDark:   '#3D2E1A',
          // Soft Terracotta — hover states, Add Person CTA
          terra:      '#E8A87C',
          terraDark:  '#C4784C',
          // Dusty Rose — female person node borders
          rose:       '#D4A5A5',
          roseDark:   '#A07575',
          // Warm White — replaces pure white across the app
          warmWhite:  '#FDFAF5',
          warmDark:   '#1A1410',
          // Deep Bark — text on sand/terracotta backgrounds
          bark:       '#5C3D2E',
          barkLight:  '#E8C9A0',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
