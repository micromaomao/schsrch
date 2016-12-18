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
    ]
  },
  plugins: [
    new OfflinePlugin({
      caches: {
        main: ['/', ':rest:']
      },
      externals: [
        '/'
      ],
      responseStrategy: 'cache-first',
      ServiceWorker: {
        scope: '/',
        publicPath: '../sw.js'
      },
      AppCache: null
    })
  ]
}
