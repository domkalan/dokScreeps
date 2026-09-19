"use strict";

import clear from 'rollup-plugin-clear';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import screeps from 'rollup-plugin-screeps';
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';
import obfuscator from 'rollup-plugin-obfuscator';
import terser from '@rollup/plugin-terser';

let cfg;
const dest = process.env.DEST;
if (!dest) {
  debugLog("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "cjs",
    sourcemap: true
  },

  plugins: [
    clear({ targets: ["dist"] }),
    resolve({ rootDir: "src" }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json", include: ["**/*.ts"], exclude: [] }),
    copy({
      targets: [
        { src: 'vendor/Traveler/Traveler.js', dest: 'dist' },
        { src: 'vendor/screeps-profiler/screeps-profiler.js', dest: 'dist' }
      ]
    }),
    terser(),
    dest === 'pserver' ? obfuscator({
      // Set to true to obfuscate the final bundle, or false to obfuscate individual source files
      global: true,

      // Configuration options passed directly to javascript-obfuscator
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        numbersToExpressions: true,
        simplify: true,
        stringArray: true,
        stringArrayThreshold: 0.75
      },

      // Exclusion patterns (only work when 'global' is set to false)
      exclude: ['node_modules/**']
    }) : undefined,
    screeps({ config: cfg, dryRun: cfg == null })
  ]
}
