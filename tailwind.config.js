/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        tijuca: {
          50: '#ecfdf3',
          100: '#d2f9df',
          500: '#2fb964',
          600: '#239952',
          700: '#1f7a45',
          950: '#101720',
        },
      },
      boxShadow: {
        panel: '0 1px 3px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
