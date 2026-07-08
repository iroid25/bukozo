const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");
const {
  default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");
import { withUt } from "uploadthing/tw";

export default withUt({
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./node_modules/react-tailwindcss-select/dist/index.esm.js",
    "./dummy-cache-bust/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(220 13% 91%)", // Light gray border
        input: "hsl(220 13% 91%)", // Light gray for inputs
        ring: "hsl(158 64% 52%)", // Emerald ring focus
        background: "hsl(0 0% 100%)", // Pure white background
        foreground: "hsl(224 71% 4%)", // Very dark gray for text
        primary: {
          DEFAULT: colors.emerald[600], // Main emerald
          50: colors.emerald[50], // Very light emerald
          100: colors.emerald[100], // Light emerald backgrounds
          200: colors.emerald[200], // Light emerald borders
          300: colors.emerald[300], // Medium light emerald
          400: colors.emerald[400], // Medium emerald
          500: colors.emerald[500], // Standard emerald
          600: colors.emerald[600], // Primary emerald
          700: colors.emerald[700], // Dark emerald
          800: colors.emerald[800], // Very dark emerald
          900: colors.emerald[900], // Darkest emerald
          950: colors.emerald[950], // Ultra dark emerald
          foreground: "hsl(0 0% 100%)", // White text on emerald
        },
        secondary: {
          DEFAULT: "hsl(210 40% 96%)", // Very light gray
          foreground: "hsl(222 84% 5%)", // Dark gray text
        },
        destructive: {
          DEFAULT: "hsl(0 84% 60%)", // Red for errors
          foreground: "hsl(0 0% 100%)", // White text on red
        },
        muted: {
          DEFAULT: "hsl(158 25% 96%)", // Very light emerald-tinted gray
          foreground: "hsl(215 16% 47%)", // Medium gray text
        },
        accent: {
          DEFAULT: "hsl(158 30% 94%)", // Light emerald accent
          foreground: "hsl(158 64% 20%)", // Dark emerald text
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)", // White popover background
          foreground: "hsl(224 71% 4%)", // Dark text in popovers
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)", // White card background
          foreground: "hsl(224 71% 4%)", // Dark text on cards
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        marquee: {
          from: {
            transform: "translateX(0)",
          },
          to: {
            transform: "translateX(calc(-100% - var(--gap)))",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "border-beam": {
          "100%": {
            "offset-distance": "100%",
          },
        },
        "marquee-vertical": {
          from: {
            transform: "translateY(0)",
          },
          to: {
            transform: "translateY(calc(-100% - var(--gap)))",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        marquee: "marquee var(--duration) infinite linear",
        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    addVariablesForColors,
    require("@tailwindcss/forms"),
  ],
});

function addVariablesForColors({ addBase, theme }: any) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );

  addBase({
    ":root": newVars,
  });
}
