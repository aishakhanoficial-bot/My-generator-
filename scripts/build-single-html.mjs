import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { build } from 'vite';

const ROOT_DIR = import.meta.dirname ? path.resolve(import.meta.dirname, '..') : process.cwd();
const TMP_OUT = path.resolve(ROOT_DIR, '.tmp-single-build');
const STANDALONE_DIR = path.resolve(ROOT_DIR, 'standalone');
const STANDALONE_HTML = path.resolve(STANDALONE_DIR, 'index.html');

export async function buildSingleHtml() {
  fs.rmSync(TMP_OUT, { recursive: true, force: true });

  await build({
    root: ROOT_DIR,
    base: './',
    logLevel: 'warn',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': ROOT_DIR,
      },
    },
    build: {
      outDir: TMP_OUT,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      rollupOptions: {
        output: {
          format: 'iife',
        },
      },
    },
  });

  const assetsDir = path.resolve(TMP_OUT, 'assets');
  const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
  const cssParts = [];
  const jsParts = [];

  for (const file of assetFiles) {
    const full = path.resolve(assetsDir, file);
    if (file.endsWith('.css')) {
      cssParts.push(fs.readFileSync(full, 'utf8'));
    } else if (file.endsWith('.js')) {
      jsParts.push(fs.readFileSync(full, 'utf8'));
    }
  }

  const combinedCss = cssParts.join('\n').replace(/<\/style/gi, '<\\/style');
  const combinedJs = jsParts.join('\n').replace(/<\/script/gi, '<\\/script');

  const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenFrame Studio — Self-Hosted AI Video Generation</title>
    <meta
      name="description"
      content="Zero-credit self-hosted AI video generation workstation with batch queueing, open-source model management, and GPU worker orchestration."
    />
    <style>${combinedCss}</style>
  </head>
  <body class="bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100 antialiased selection:bg-sky-500/20 selection:text-sky-600 dark:selection:text-sky-300">
    <div id="root"></div>
    <script>window.__SINGLE_FILE_HTML__ = true;</script>
    <script>${combinedJs}</script>
  </body>
</html>
`;

  fs.mkdirSync(STANDALONE_DIR, { recursive: true });
  fs.writeFileSync(STANDALONE_HTML, html, 'utf8');
  fs.rmSync(TMP_OUT, { recursive: true, force: true });

  const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`Built single-file HTML: ${STANDALONE_HTML} (${sizeKb} KB)`);
  return STANDALONE_HTML;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isDirectRun) {
  buildSingleHtml().catch((err) => {
    console.error('Single HTML build failed:', err);
    process.exit(1);
  });
}
