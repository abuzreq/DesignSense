const webpack = require('webpack');
const path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const HtmlWebpackPlugin = require('vue-html-webpack-plugin')
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin')

const ASSET_PATH = process.env.ASSET_PATH || '/';


const config = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: ASSET_PATH,
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.jpg$/,
        use: [
          {
            loader: 'vue-loader',
            options: {
              mimetype: 'image/jpg',
              esModule: false,
            }
          }
        ]
      },
      {
        test: /\.svg$/,
        use: [
          'vue-svg-loader',

          'babel-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|eot|ttf|woff|woff2|svg)(\?.+)?$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 10000,
            },
            
          },
        ],
      },
      {
        test: /\.css$/i,
        use: [ 'style-loader','css-loader'],
      },
      {
        test: /\.s[a|c]ss$/,
 
        use: [
          'vue-style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            
            // Requires sass-loader@^7.0.0
            options: {
              implementation: require('sass'),
              fiber: require('fibers'),
              indentedSyntax: true // optional
            },
            // Requires sass-loader@^8.0.0
            options: {
              implementation: require('sass'),
              sassOptions: {
                fiber: require('fibers'),
                indentedSyntax: true // optional
              },
            },
          },
        ],
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              outputPath: "assets/",
              publicPath: "assets/"
            }
          }
        ]
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
      },
      {
        test: /\.jpg$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              mimetype: 'image/jpg'
            }
          }
        ]
      },
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
    new VuetifyLoaderPlugin(),
    new LodashModuleReplacementPlugin,

    new HtmlWebpackPlugin({
      vue: true
    })
  ]
};

module.exports = config;