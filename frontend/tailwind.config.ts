import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kit: {
          DEFAULT: '#ff6b35',
          dark: '#e0531f',
          light: '#ffe8dc',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
