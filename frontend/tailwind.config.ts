import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14213D',
          light: '#24345C',
          dark: '#0A1426',
        },
        coral: {
          DEFAULT: '#F6635C',
          dark: '#D94840',
          light: '#FA9890',
          pale: '#FDE9E7',
        },
        teal: {
          DEFAULT: '#0E7C7B',
          dark: '#0A5F5E',
          light: '#3FA39B',
          pale: '#E1F3F1',
        },
        cream: {
          DEFAULT: '#F7F3E8',
          dark: '#ECE1C9',
        },
        charcoal: {
          DEFAULT: '#262629',
          light: '#5B5B63',
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
