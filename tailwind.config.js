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
        charcoal: {
          DEFAULT: '#24272B',
          dark: '#1A1D20',
          light: '#32373D',
        },
        racingOrange: {
          DEFAULT: '#F97316',
          hover: '#EA580C',
          dark: '#C2410C',
          light: '#FFF7ED',
          muted: '#FED7AA',
        },
        brand: {
          DEFAULT: '#F97316',
          dark: '#EA580C',
          charcoal: '#24272B',
          light: '#FFF7ED',
          muted: '#FED7AA',
        },
        lightGray: '#F3F4F6',
        borderGray: '#E5E7EB',
        darkText: '#111827',
        mutedText: '#6B7280',
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
