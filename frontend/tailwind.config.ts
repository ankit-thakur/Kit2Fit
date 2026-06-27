import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0C2340',
          light: '#1F3A63',
          dark: '#071630',
        },
        blue: {
          DEFAULT: '#006BB6',
          light: '#3FA9F5',
          pale: '#E3F2FC',
        },
        orange: {
          DEFAULT: '#F58426',
          dark: '#D4691A',
          light: '#FBC692',
          pale: '#FDEBD8',
        },
        cream: {
          DEFAULT: '#FAF6EC',
          dark: '#F1E9D8',
        },
        charcoal: {
          DEFAULT: '#1A1A1E',
          light: '#54545B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
