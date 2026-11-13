// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import type { RollupLog, RollupOptions } from 'rollup';

// Dependencies such as @actions/* ship TypeScript-compiled ESM that references top-level
// `this` (correctly rewritten to undefined) and has internal circular imports. Both are
// harmless, so only silence them when every module involved is in node_modules.
const IGNORED_DEPENDENCY_WARNINGS = new Set(['THIS_IS_UNDEFINED', 'CIRCULAR_DEPENDENCY']);
const isDependencyOnlyWarning = (warning: RollupLog): boolean => {
  const ids = warning.ids ?? (warning.id ? [warning.id] : []);
  return (
    IGNORED_DEPENDENCY_WARNINGS.has(warning.code ?? '') &&
    ids.length > 0 &&
    ids.every((id) => id.includes('/node_modules/'))
  );
};

const config: RollupOptions = {
  onwarn(warning, warn) {
    if (isDependencyOnlyWarning(warning)) return;
    warn(warning);
  },
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true
  },
  plugins: [
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
        emitDeclarationOnly: false
      }
    }),
    nodeResolve({ preferBuiltins: true }),
    commonjs()
  ]
};

export default config;
