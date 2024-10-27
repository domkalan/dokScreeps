const typescript = require('@rollup/plugin-typescript');
const progress = require('rollup-plugin-progress');

module.exports = [
    {
        input: 'src/main.ts',
        output: [
            {
                name: 'main',
                file: 'dist/main.js',
                format: 'iife',
            }
        ],
        plugins: [typescript(), progress({clearLine: true})]
    }
]