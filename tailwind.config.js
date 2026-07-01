/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'jokenia-dark': '#3D3D2E',
        'jokenia-dark2': '#56503E',
        'jokenia-gold': '#C9A96E',
        'jokenia-cream': '#F5EDD8',
        'jokenia-cream2': '#F2EDE4',
        'jokenia-tan': '#8B6F47',
        'jokenia-sand': '#D4B483'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        heading: ['Syne', 'sans-serif']
      }
    }
  },
  plugins: []
}
