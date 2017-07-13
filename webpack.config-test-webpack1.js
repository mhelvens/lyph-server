var webpack = require('webpack');

var path = require('path');
var fs   = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
	.filter(function(x) { return ['.bin'].indexOf(x) === -1 })
	.filter(function(x) { return ['open-physiology-manifest'].indexOf(x) === -1 })
    .filter(function(x) { return ['open-physiology-model'].indexOf(x) === -1 })
    .filter(function(x) { return ['utilities'].indexOf(x) === -1 })
    .forEach(function(mod) { nodeModules[mod] = 'commonjs ' + mod });

module.exports = {
	devtool: 'source-map',
	module: {
		loaders: [
			{
				test: /open-physiology-manifest/,
				loader: 'babel'
			},
            {
                test: /open-physiology-model/,
                loader: 'babel'
            },
			{
				test: /\.js$/,
				exclude: /node\_modules/,
				loader: 'babel'
			},
			{
				test: /\.json$/,
				loader: 'json'
			},
			{
                test: /open-physiology-model[\/\\]src[\/\\]index\.js$/,
                loader: 'babel'
            },
            {
                test: /open-physiology-manifest[\/\\]src[\/\\]index\.js$/,
                loader: 'babel'
            },
			{
				test: /node_modules[\/\\]utilities[\/\\]src[\/\\].*\.js$/,
				loader: 'babel-loader'
			}
		]
	},
	output: {
		// source-map support for IntelliJ/WebStorm
		devtoolModuleFilenameTemplate:         '[absolute-resource-path]',
		devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]'
	},
	target: 'node',
	node: {
		__filename: true,
		__dirname:  false
	},
	externals: [require('webpack-node-externals')({
        whitelist: ['utilities']
    })].concat(nodeModules)
};
