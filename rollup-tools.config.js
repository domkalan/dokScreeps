const typescript = require('@rollup/plugin-typescript');
const progress = require('rollup-plugin-progress');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('tools/').filter(file => file.endsWith('.ts')).map(file => { 
    const fileName = file.split('.').shift();

    return {
        input: path.join('tools/', file),
        output: [
            {
                name: fileName,
                file: 'dist/tools/' + fileName + '.js',
                format: 'iife',
            }
        ],
        plugins: [typescript(), progress({clearLine: true})]
    }
});

module.exports = files;