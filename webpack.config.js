const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');

// Where the app is served from. Netlify serves it at the domain root.
const ASSET_PATH = process.env.ASSET_PATH || '/';

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  // `webpack serve` sets this. It is the difference between a development
  // build that is about to be served with hot reloading and one being written
  // to disk, which must not carry hot-accept code it has no runtime for.
  const isServed = !!(env && env.WEBPACK_SERVE);

  return {
    // Named explicitly so the "@" alias and every relative path resolve
    // against this file rather than whichever directory npm was run from.
    context: __dirname,
    entry: './src/main.js',

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
      // Code fetched on demand, such as the 3D viewer. Hashed, so a new
      // release never serves a chunk cached from the last one.
      chunkFilename: '[name].[contenthash:8].js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext][query]',
      publicPath: ASSET_PATH,
      clean: true,
    },

    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',

    cache: {
      type: 'filesystem',
      buildDependencies: { config: [__filename] },
      // A served build compiles hot-reload code into its modules and a
      // written one must not. Sharing a cache, `npm run start-prod` left
      // modules that `npm run build-prod` then failed on: "No template for
      // dependency: ModuleHotAcceptDependency".
      name: (isServed ? 'serve-' : 'build-') + (isProduction ? 'production' : 'development'),
    },

    resolve: {
      extensions: ['.js', '.vue'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // jsPDF reaches for these only to draw HTML or SVG into a page; the
        // story report hands it finished pictures, so they stay out of the
        // build (canvg doesn't even build here, wanting process/browser).
        canvg: false,
        html2canvas: false,
        dompurify: false,
      },
    },

    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: { hotReload: isServed },
        },

        // An .svg is either a Vue component or a URL, never both: `oneOf`
        // stops a second rule from claiming a file the first already took,
        // which is how the teaser image ended up being JavaScript.
        {
          test: /\.svg$/i,
          oneOf: [
            { resourceQuery: /component/, use: ['vue-svg-loader'] },
            { type: 'asset' },
          ],
        },

        // Under 10 kB becomes a data URI, as url-loader's old limit did.
        {
          test: /\.(png|jpe?g|gif|webp)$/i,
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 10 * 1024 } },
        },

        // Always files: the smallest icon font here is 60 kB.
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },

        // `sourceMap` follows devtool unless it is said here, and these
        // loaders write their maps into the stylesheet as base64 -- which put
        // 1.2 MB of mappings inside the production bundle. Worth having while
        // developing, worth nothing to a visitor.
        {
          test: /\.css$/i,
          use: [
            'vue-style-loader',
            // vue-style-loader reads CommonJS, not ES modules.
            {
              loader: 'css-loader',
              options: { esModule: false, sourceMap: !isProduction },
            },
          ],
        },

        // Vuetify ships its components' styles as indented .sass; sass-loader
        // picks the syntax from the extension, so nothing has to say so here.
        {
          test: /\.s[ac]ss$/i,
          use: [
            'vue-style-loader',
            {
              loader: 'css-loader',
              options: {
                esModule: false,
                importLoaders: 1,
                sourceMap: !isProduction,
              },
            },
            {
              loader: 'sass-loader',
              options: {
                implementation: require('sass'),
                sourceMap: !isProduction,
              },
            },
          ],
        },
      ],
    },

    plugins: [
      // A few dependencies reach for Node's `process` -- node-kmeans calls
      // process.nextTick, vue-tour and vue-3d-model read process.env. webpack 4
      // shimmed it silently; webpack 5 does not, and the first sign is a
      // ReferenceError deep inside a feature. This is the whole shim: nothing
      // in src/ asks for it.
      new webpack.ProvidePlugin({ process: 'process/browser' }),
      // The version the app shows and reports with feedback: package.json's,
      // so the two can't drift apart.
      new webpack.DefinePlugin({
        __APP_VERSION__: JSON.stringify(require('./package.json').version),
      }),
      new VueLoaderPlugin(),
      // src/plugins/vuetify.js imports vuetify/lib, which registers nothing on
      // its own: this is what turns each <v-btn> in a template into an import
      // of that component. Without it every Vuetify tag renders as an unknown
      // element. It has to come after VueLoaderPlugin, which is what rewrites
      // the .vue rule into the shape this one looks for.
      new VuetifyLoaderPlugin(),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        title: 'DesignSense',
      }),
    ],

    devServer: {
      port: 8080,
      hot: true,
      // The bundle and index.html are served from memory. This is only so a
      // study in testdata/ can be opened by link while developing.
      static: [
        {
          directory: path.resolve(__dirname, 'testdata'),
          publicPath: '/testdata',
        },
      ],
      client: { overlay: { errors: true, warnings: false } },
      // The router is in hash mode, so no history fallback is needed.
    },

    // vue-loader 15 writes `import style0 from "...type=style"` for every
    // block of styles in a component, while vue-style-loader hands back a
    // CommonJS module whose exports webpack cannot see through. The styles are
    // injected by the import itself, so the missing binding is harmless -- but
    // it is one warning per styled component, which buries real ones.
    ignoreWarnings: [/export 'default' \(imported as 'style\d+'\) was not found/],

    // The bundle is large and known to be; the warning says nothing new.
    performance: { hints: false },
  };
};
