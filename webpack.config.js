const webpack = require('webpack');
const path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const HtmlWebpackPlugin = require('vue-html-webpack-plugin')
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin')

const config = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: [ 'style-loader','css-loader'],
      },
      {
        test: /\.png$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              mimetype: 'image/png'
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: [
      '.js',
      '.vue'
    ],
    alias: {
      '@': path.resolve('src')
    }
  },
  plugins: [
    new VueLoaderPlugin(),
    new LodashModuleReplacementPlugin,
    new HtmlWebpackPlugin({
      vue: true
    })
  ]
};

module.exports = config;