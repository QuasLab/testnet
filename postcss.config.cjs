/** @type {import('postcss-load-config').Config} */
const config = {
  map: process.env.NODE_ENV === 'development',
  plugins: [require('tailwindcss/nesting')(require('postcss-nesting')), require('tailwindcss'), require('autoprefixer')]
}

module.exports = config
