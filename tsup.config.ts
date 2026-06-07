import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  target: 'node18',
  outDir: 'dist',
  dts: true,
  sourcemap: true,
  splitting: false,
  shims: true,
};

export default defineConfig([
  {
    // Library entry — importable; no shebang.
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
  },
  {
    // Executable CLI — gets the shebang so it runs as a bin.
    ...shared,
    entry: { 'cli/index': 'src/cli/index.ts' },
    clean: false, // don't wipe the library build above
    banner: { js: '#!/usr/bin/env node' },
  },
]);
