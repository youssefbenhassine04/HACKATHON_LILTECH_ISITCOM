/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary-color, #0b2545)',
          hover: 'var(--primary-hover, #081d37)',
          light: 'var(--primary-light, #133a6b)',
        },
        success: {
          DEFAULT: 'var(--success-color, #1f9d55)',
          hover: 'var(--success-hover, #188246)',
          light: 'var(--success-light, #eafaf1)',
        },
        destructive: {
          DEFAULT: 'var(--destructive-color, #d62828)',
          hover: 'var(--destructive-hover, #b81f1f)',
          light: 'var(--destructive-light, #fde8e8)',
        },
        tunisia: {
          navy: '#0b2545',
          gold: '#c59b27',
          red: '#d62828',
          green: '#1f9d55',
          dark: '#051329',
          lightBg: '#f8fafc',
          border: '#e2e8f0'
        }
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      screens: {
        'print': {'raw': 'print'},
      }
    },
  },
  plugins: [],
}
