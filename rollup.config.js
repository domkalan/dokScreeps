"use strict";

import clear from 'rollup-plugin-clear';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import screeps from 'rollup-plugin-screeps';
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';

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
    screeps({ config: cfg, dryRun: cfg == null })
  ]
}
