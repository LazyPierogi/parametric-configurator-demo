import type { Config } from 'tailwindcss';
import { tailwindExtend } from './tokens/generated/tailwind.extend';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './stories/**/*.{ts,tsx}'],
  theme: {
    extend: {
      ...tailwindExtend,
    },
  },
  plugins: [],
};

export default config;
