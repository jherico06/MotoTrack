/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: 'class',
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0C6258',
          dark: '#084A43',
          light: '#E7F5F3',
          muted: '#D1ECE6',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        plusJakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        manrope: ['"Plus Jakarta Sans"', 'sans-serif'],
        inter: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
