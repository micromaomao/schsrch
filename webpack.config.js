const path = require('path')

module.exports = {
  entry: './view/entry.jsx',
  output: {
    path: './dist',
    publicPath: 'resources/',
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
  }
}
