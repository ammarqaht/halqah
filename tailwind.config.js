/* Tokens transcribed verbatim from DESIGN.md §1–§3. Do not edit here alone. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#F4F5F1',
        paper: '#FAFBF8',
        ink: {
          900: '#191E1C', 800: '#252B29', 700: '#39423F', 600: '#525C58',
          500: '#6C7773', 400: '#8D9894', 300: '#B4BDB8', 200: '#D6DCD6',
          150: '#E3E7E1', 100: '#EAEEE8',
        },
        brand: {
          900: '#0A403C', 800: '#0B5F59', 700: '#0E8D83', 600: '#3C9E96',
          400: '#7FBBB4', 300: '#A9D0CB', 200: '#CFE2DF', 100: '#E4EEEB', 50: '#EFF4F2',
        },
        sage: { 700: '#5E6F66', 500: '#7E8F86', 300: '#A8B5AC', 100: '#DFE5DF' },
        assoc: { 900: '#1B1C57', 700: '#2E3070', 300: '#5AB8DE', 100: '#E7F2F8' },
        ok:   { 700: '#3E6B54', 500: '#4E7C63', 200: '#CBDBD0', 100: '#E3EAE4' },
        warn: { 700: '#7F6531', 500: '#9A7B3F', 200: '#E2D6BC', 100: '#F0EADC' },
        info: { 700: '#4B5C77', 500: '#5C6E8A', 200: '#CBD3E0', 100: '#E5E9F0' },
        risk: { 700: '#834B42', 500: '#9A5A50', 200: '#E0C9C4', 100: '#F0E4E1' },
      },
      fontFamily: {
        sans: ['BrandArabic', 'SF Arabic', 'Geeza Pro', 'Segoe UI', 'Tahoma', 'sans-serif'],
        display: ['BrandDisplay', 'BrandArabic', 'SF Arabic', 'Geeza Pro', 'serif'],
      },
      fontSize: {
        /* editorial — reading surfaces */
        micro: ['11.5px', { lineHeight: '1.5', letterSpacing: '0.06em' }],
        xs2:   ['12.5px', { lineHeight: '1.6' }],
        sm2:   ['13.5px', { lineHeight: '1.65' }],
        base2: ['15px',   { lineHeight: '1.75' }],
        lg2:   ['17px',   { lineHeight: '1.6' }],
        xl2:   ['19px',   { lineHeight: '1.5' }],
        t1:    ['24px',   { lineHeight: '1.35' }],
        d2:    ['32px',   { lineHeight: '1.22' }],
        d1:    ['40px',   { lineHeight: '1.14' }],
        d0:    ['52px',   { lineHeight: '1.08' }],
        /* dense — work surfaces */
        '2xs': ['10.5px', { lineHeight: '1.45', letterSpacing: '0.05em' }],
        cap:   ['12px',   { lineHeight: '1.5' }],
        panel: ['13px',   { lineHeight: '1.6' }],
        body:  ['14px',   { lineHeight: '1.65' }],
        h3:    ['18px',   { lineHeight: '1.45' }],
        h2:    ['22px',   { lineHeight: '1.35' }],
        num:   ['32px',   { lineHeight: '1.1' }],
      },
      spacing: { 1.5: '6px', 4.5: '18px', 13: '52px', 15: '60px', 18: '72px', 22: '88px', 26: '104px', 60: '240px' },
      borderRadius: { sm: '3px', DEFAULT: '5px', md: '7px', lg: '10px', xl: '14px', '2xl': '20px' },
      maxWidth: { column: '1120px' },
      boxShadow: {
        rail: '0 0 0 1px rgba(10,64,60,.06), -8px 0 24px -18px rgba(10,64,60,.45)',
        card: '0 1px 2px rgba(25,30,28,.04)',
        soft: '0 2px 10px -4px rgba(25,30,28,.10), 0 0 0 1px rgba(25,30,28,.04)',
        pop:  '0 12px 32px -12px rgba(25,30,28,.28), 0 0 0 1px rgba(25,30,28,.06)',
      },
      transitionTimingFunction: { brand: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    },
  },
  plugins: [],
};
