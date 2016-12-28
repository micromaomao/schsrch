const path = require('path')
const OfflinePlugin = require('offline-plugin')

module.exports = {
  entry: './view/entry.jsx',
  output: {
    path: './dist',
    publicPath: '/resources/',
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      { test: /\.sass$/, loaders: ['style', 'css', 'sass'] },
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
      }
    ]
  },
  plugins: [
    new OfflinePlugin({
      caches: {
        main: ['/', ':rest:', '/manifest.json'],
        additional: ['/resources/icon-192.png']
      },
      externals: [
        '/',
        '/manifest.json',
        '/resources/icon-192.png',
        '/resources/icon-144.png'
      ],
      responseStrategy: 'cache-first',
      version: '0.3.0',
      ServiceWorker: {
        scope: '/',
        publicPath: '../sw.js'
      },
      AppCache: null
    })
  ]
}
