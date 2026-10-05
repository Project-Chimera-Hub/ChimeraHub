/*
 * The hub's look, applied where this app actually takes its colours from.
 *
 * Everything here is Tailwind utilities — `bg-gray-900`, `text-cyan-400` and
 * ninety more — so retuning custom properties alone would reach a third of the
 * page and leave the rest grey and cyan. Remapping the two scales the app uses
 * reaches all of it, and no component has to be touched.
 *
 * `gray` becomes the warm near-blacks the hub is built on and `cyan` becomes
 * its old gold. Every other scale is untouched: green, red and amber are
 * right, wrong and warning here, and they mean things.
 *
 * Radii go square, except `rounded-full` — that one is a circle, and the
 * circles are circles on purpose.
 *
 * This used to be an inline `tailwind.config` for the Tailwind CDN script. It
 * is built now, so the app makes no request to anybody.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './hooks/**/*.ts'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-monospace', '"JetBrains Mono"', '"IBM Plex Mono"', '"SF Mono"',
               'SFMono-Regular', 'Menlo', 'Consolas', '"DejaVu Sans Mono"', 'monospace'],
      },
      colors: {
        gray: {
          50: '#f8f0da', 100: '#eadfc2', 200: '#d6c8a3', 300: '#bfae83',
          400: '#a48f60', 500: '#7d6c48', 600: '#584c33', 700: '#3a3222',
          800: '#2a2312', 900: '#14110a', 950: '#0a0906',
        },
        cyan: {
          50: '#fbf6e6', 100: '#f8f0da', 200: '#f0e2b4', 300: '#f0d27a',
          400: '#d4af37', 500: '#b8962c', 600: '#957823', 700: '#735c1b',
          800: '#4f4013', 900: '#2f260b', 950: '#1a1506',
        },
      },
      borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0' },
    },
  },
  plugins: [],
};
