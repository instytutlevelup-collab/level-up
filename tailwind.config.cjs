/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          pink: '#fcd5ce',
          blue: '#cce3f0',
          green: '#d8f3dc',
          yellow: '#fff5ba',
          purple: '#e0bbf9',
          gray: '#f1f1f1',
        },
      },
    },
  },
  plugins: [],
}