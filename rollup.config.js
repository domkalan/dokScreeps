const typescript = require('@rollup/plugin-typescript');

module.exports = [
    {
        input: 'src/main.ts',
        output: {
            name: 'main',
            file: 'main.js',
            format: 'iife'
        },
        plugins: [typescript()]
    }
]