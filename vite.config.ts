import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeBasePath } from './shared/basePath';
export default defineConfig(({ command, mode }) => ({
  base: normalizeBasePath(
    process.env.VITE_BASE_PATH ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH ?? '/',
  ),
  plugins: [
    react(),
    {
      name: 'development-csp',
      transformIndexHtml: (html) =>
        command === 'serve'
          ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/i, '')
          : html,
    },
  ],
  build: { sourcemap: false },
}));
