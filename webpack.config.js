const path = require('path')
const OfflinePlugin = require('offline-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: {
    'bundle': './view/entry.jsx'
  },
  output: {
    path: './dist',
    publicPath: '/resources/',
    filename: '[hash].js'
  },
  module: {
    loaders: [
      { test: /\.sass$/, loaders: ['css', 'sass'] },
      {
        test: /\.jsx$/,
        loader: 'babel',
        query: {
          presets: ['es2015'],
          plugins: ['transform-react-jsx']
        }
      },
      {
        test: /\.js$/,
        loader: 'babel',
        query: {
          presets: ['es2015'],
        }
      },
      {
        test: /\.png$/,
        loader: 'file'
      },
      {
        test: /\.pug$/,
        loader: 'pug'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './view/index.pug',
      minify: {removeComments: true, useShortDoctype: true, sortClassName: true, sortAttributes: true}
    }),
    new OfflinePlugin({
      caches: {
        main: [':rest:']
      },
      responseStrategy: 'cache-first',
      version: '0.5.0',
      ServiceWorker: {
        scope: '/',
        publicPath: '../sw.js'
      },
      AppCache: null,
      rewrites: {
        'index.html': '/'
      }
    })
  ],
  debug: true
}
