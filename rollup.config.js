import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json';
import css from 'rollup-plugin-css-only';

const { main: umd, module: es } = pkg;
const name = pkg.name
    .replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
    .replace(/^\w/, m => m.toUpperCase())
    .replace(/-\w/g, m => m[1].toUpperCase());

const production = !process.env.ROLLUP_WATCH;

const globals = {
    'svelte': 'svelte',
    'svelte/store': 'store'
};


export default {
    input: 'src/index.js',
    output: [{
            file: es,
            format: 'es',
            sourcemap: true,
            name,
            globals,
        },
        {
            file: umd,
            format: 'umd',
            sourcemap: true,
            name,
            globals,
        }
    ],
    external: Object.keys(globals),
    plugins: [
        svelte({
            compilerOptions: {
                dev: !production,
            },
        }),
        css({ output: 'bundle.css' }),

        // If you have external dependencies installed from
        // npm, you'll most likely need these plugins. In
        // some cases you'll need additional configuration -
        // consult the documentation for details:
        // https://github.com/rollup/plugins/tree/master/packages/commonjs
        resolve({
            browser: true,
            dedupe: ['svelte'],
        }),
        commonjs({
            include: 'node_modules/**',
        })
    ],
};