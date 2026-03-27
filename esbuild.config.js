const esbuild = require('esbuild');

async function build() {
  await esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    minify: true,
    sourcemap: true,
  });

  // Bundle script for webview
  await esbuild.build({
    entryPoints: ['./src/media/main.ts'],
    bundle: true,
    outfile: 'out/media/main.js',
    minify: true,
    sourcemap: true,
  }).catch(() => {
    // Media files are copied directly, so if main.js doesn't exist to bundle, ignore.
  });
}

build().catch(() => process.exit(1));
