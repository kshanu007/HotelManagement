import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: Object.keys(pkg.dependencies).filter((k) => !k.startsWith('@annapurna/')),
});
