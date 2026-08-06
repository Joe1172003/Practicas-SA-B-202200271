import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// El plugin de Tailwind v4 procesa las clases directamente desde Vite:
// no hace falta tailwind.config.js ni postcss.config.js.
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173,

    // Sin esto, si el 5173 está ocupado Vite se cambia al 5174 SIN AVISAR y
    // el backend rechaza todo por CORS (solo autoriza el origen de
    // CORS_ORIGIN). Con strictPort, Vite se niega a arrancar y dice que el
    // puerto está ocupado: un error claro en vez de uno confuso más adelante.
    strictPort: true,
  },
});