const path = require('path')
const OfflinePlugin = require('offline-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

baseConfig = {
  module: {
    loaders: [
      { test: /\.sass$/, loaders: ['css-loader', 'sass-loader'] },
      {
        test: /\.jsx$/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015'],
          plugins: ['transform-react-jsx']
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015'],
        }
      },
      {
        test: /\.png$/,
        loader: 'file-loader'
      },
      {
        test: /\.pug$/,
        loader: 'pug-loader'
      }
    ]
  }
}

module.exports = [
  Object.assign({}, baseConfig, {
    entry: {
      'clientrender': './view/clientrender.jsx',
    },
    output: {
      path: path.join(__dirname, './dist'),
      publicPath: '/resources/',
      filename: '[hash]-[name].js'
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './view/index.pug',
        minify: {removeComments: true, useShortDoctype: true, sortClassName: true, sortAttributes: true},
        chunks: [ 'clientrender' ],
        inject: false
      }),
      new OfflinePlugin({
        caches: {
          main: [':rest:']
        },
        responseStrategy: 'cache-first',
        version: '0.5.0',
        ServiceWorker: {
          scope: '/',
          publicPath: '/sw.js'
        },
        AppCache: null,
        rewrites: {
          'index.html': '/'
        }
      })
    ]
  }),
  Object.assign({}, baseConfig, {
    entry: {
      'serverrender': './view/serverrender.jsx'
    },
    target: 'node',
    output: {
      path: path.join(__dirname, './dist-server'),
      publicPath: '/resources/',
      filename: '[name].js'
    },
    plugins: [
    ]
  })
]
