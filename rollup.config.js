const typescript = require('@rollup/plugin-typescript');
const terser = require('@rollup/plugin-terser');
const progress = require('rollup-plugin-progress');

module.exports = [
    {
        input: 'src/main.ts',
        output: [
            {
                name: 'main',
                file: 'dist/main.js',
                format: 'iife',
            },
            {
                name: 'main',
                file: 'dist/main.min.js',
                format: 'iife',
                plugins: [terser()]
            },
        ],
        plugins: [typescript(), progress({clearLine: true})]
    }
]