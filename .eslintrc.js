module.exports = {
	env: {
		es2020: true,
		node: true,
	},
	extends: [
		'airbnb-base',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 11,
		sourceType: 'module',
	},
	plugins: [
		'@typescript-eslint',
	],
	rules: {
		'no-underscore-dangle': 'off',
		'import/extensions': 'off',
		'no-console': 'off',
		'import/prefer-default-export': 'off',
		'no-plusplus': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		'max-classes-per-file': 'off',
		'camelcase': 'off',
		'no-tabs': [
			'error',
			{
				allowIndentationTabs: true,
			},
		],
		indent: [
			'error',
			'tab',
			{
				SwitchCase: 1,
			},
		],
		'max-len': ['error', { ignoreComments: true, code: 160 }],
		'@typescript-eslint/no-unused-vars': [
			'error',
			{ argsIgnorePattern: '^_' },
		],
		'@typescript-eslint/no-non-null-assertion': 'off',
		'class-methods-use-this': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/ban-types': 'off',
		'no-useless-constructor': 'off',
		'import/no-extraneous-dependencies': 'off',
		'no-shadow': 'off',
		'no-use-before-define': [2, 'nofunc'],
		'no-await-in-loop': 'off',
		'no-param-reassign': 'off',
		'no-restricted-syntax': 'off',
		'no-inner-declarations': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off'
	},
	settings: {
		'import/resolver': {
			node: {
				extensions: [
					'.js',
					'.jsx',
					'.ts',
					'.tsx',
				],
			},
		},
	},
};
