const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const dev = process.env.NODE_ENV !== 'production'

baseConfig = {
  mode: dev ? 'development' : 'production',
  module: {
    rules: [
      {
        test: /\.sass$/, use: [
          {
            loader: 'css-loader',
            options: {
              exportType: 'string'
            }
          }, {
            loader: 'sass-loader'
          }
        ]
      },
      {
        test: /\.jsx$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: "> 0.25%, not dead"
                }]
              ],
              plugins: ['@babel/plugin-transform-react-jsx']
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
              presets: [
                ['@babel/preset-env', {
                  targets: "> 0.25%, not dead"
                }]
              ]
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
      filename: '[name].js'
    },
    optimization: {
      minimize: false
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './view/index.pug',
        minify: dev ? false : { removeComments: true, useShortDoctype: true, sortClassName: true, sortAttributes: true },
        chunks: ['clientrender'],
        inject: false
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
      })
    ]
  }),
  Object.assign({}, baseConfig, {
    module: Object.assign({}, baseConfig.module, {
      rules: [
        {
          test: /\.sass$/, use: [
            {
              loader: 'css-loader',
              options: {
                exportType: 'string'
              }
            }, {
              loader: 'sass-loader'
            }
          ]
        },
        {
          test: /\.jsx$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [['@babel/preset-env', {
                  targets: {
                    node: 'current'
                  }
                }]],
                plugins: ['@babel/plugin-transform-react-jsx']
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
                presets: [['@babel/preset-env', {
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
    optimization: {
      minimize: !dev
    },
    output: {
      path: path.join(__dirname, './dist-server'),
      publicPath: '/resources/',
      filename: '[name].js'
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
      })
    ]
  })
]
