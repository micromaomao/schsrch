const path = require('path')
const webpack = require('webpack')
const OfflinePlugin = require('offline-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const dev = process.env.NODE_ENV !== 'production'

baseConfig = {
  mode: dev ? 'development' : 'production',
  module: {
    rules: [
      { test: /\.sass$/, use: ['css-loader', 'sass-loader'] },
      {
        test: /\.jsx$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['env'],
              plugins: ['transform-react-jsx']
            }
          }
        ]
      },
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['env']
            }
          }
        ]
      },
      {
        test: /\.png$/,
        use: 'file-loader'
      },
      {
        test: /\.pug$/,
        use: [
          {
            loader: 'pug-loader',
            options: {}
          }
        ]
      }
    ]
  },
  devtool: 'source-map'
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
        minify: dev ? false : {removeComments: true, useShortDoctype: true, sortClassName: true, sortAttributes: true},
        chunks: [ 'clientrender' ],
        inject: false
      }),
      new OfflinePlugin({
        caches: {
          main: [':rest:', '/resources/pdfjs/pdf.min.js', '/resources/pdfjs/pdf.worker.min.js']
        },
        responseStrategy: 'cache-first',
        version: '2.0.0',
        ServiceWorker: {
          scope: '/',
          publicPath: '/sw.js',
          minify: !dev && false // FIXME
        },
        AppCache: null,
        rewrites: {
          'index.html': '/'
        }
      })
    ].filter(x => x !== null)
  }),
  Object.assign({}, baseConfig, {
    module: Object.assign({}, baseConfig.module, {
      rules: [
        { test: /\.sass$/, use: ['css-loader', 'sass-loader'] },
        {
          test: /\.jsx$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [['env', {
                  targets: {
                    node: 'current'
                  }
                }]],
                plugins: ['transform-react-jsx']
              }
            }
          ]
        },
        {
          test: /\.js$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [['env', {
                  targets: {
                    node: 'current'
                  }
                }]]
              }
            }
          ]
        }
      ]
    }),
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
