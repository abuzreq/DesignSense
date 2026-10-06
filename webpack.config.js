const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');
const fs = require('fs');
const { execSync } = require('child_process');

// The site's own address, for what a search engine reads: the guide's
// canonical link and the sitemap. Netlify sets URL to the site's primary
// address -- designsense-beta.netlify.app while that is where it lives, and
// designsense.app once that domain is attached -- so the move needs no edit
// here, and a canonical link never points at a domain that is not serving the
// site yet. SITE_URL overrides it; the fallback is for a local build, which
// nothing indexes.
const SITE = asOrigin(process.env.SITE_URL || process.env.URL || 'https://designsense.app');

/** One trailing slash, since every use below appends a path to this. */
function asOrigin(url) {
  return String(url).trim().replace(/\/+$/, '') + '/';
}

/**
 * Writes the two small files a search engine asks a site for. The guide is a
 * page of its own (wiki/) so that it can be found apart from the app, whose
 * routes all sit behind a "#" and so count as one page.
 */
class DiscoveryFilesPlugin {
  apply(compiler) {
    const { RawSource } = compiler.webpack.sources;
    compiler.hooks.thisCompilation.tap('DiscoveryFilesPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'DiscoveryFilesPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const pages = [SITE, SITE + 'wiki/'];
          compilation.emitAsset(
            'sitemap.xml',
            new RawSource(
              [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                ...pages.map((page) => '  <url><loc>' + page + '</loc></url>'),
                '</urlset>',
                '',
              ].join('\n')
            )
          );
          compilation.emitAsset(
            'robots.txt',
            new RawSource(
              ['User-agent: *', 'Allow: /', '', 'Sitemap: ' + SITE + 'sitemap.xml', ''].join('\n')
            )
          );
        }
      );
    });
  }
}

// Where a written production build leaves its source maps: beside `dist`
// rather than inside it, because `dist` is the directory Netlify publishes.
const SOURCEMAP_DIR = 'sourcemaps';

/** The commit a build was made from, for the note in the stash. */
function commitRef() {
  // Netlify sets this; a local build has git to ask instead.
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF;
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Moves the source maps out of the directory that gets published.
 *
 * `hidden-source-map` writes the maps but leaves no "//# sourceMappingURL"
 * comment in the bundles, so nothing asks for one and no visitor fetches one.
 * They are still worth keeping, because a map is the only way to read a
 * minified frame from a bug report back to a file and a line -- src/errors.js
 * reports the stack as the engine wrote it, and nothing rewrites that on its
 * own. What they must not do is sit in `dist`, where all fifteen megabytes are
 * uploaded with the site and anyone who guesses a filename can read the whole
 * of src/ out of them.
 *
 * The stash holds one build's maps: it is emptied as each build fills it, so
 * what is in it always belongs to what is in `dist`. Copy the directory
 * somewhere else to keep a release's maps for longer than the next build.
 */
class StashSourceMapsPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('StashSourceMapsPlugin', (compilation) => {
      const log = compilation.getLogger('StashSourceMapsPlugin');
      const maps = Object.keys(compilation.assets).filter((name) =>
        name.endsWith('.map')
      );
      if (!maps.length) return;

      const from = compiler.options.output.path;
      const to = path.resolve(__dirname, SOURCEMAP_DIR);
      try {
        fs.rmSync(to, { recursive: true, force: true });
      } catch (e) {
        // Not fatal: the files below are overwritten anyway. It only means an
        // earlier build's hashed chunks may still be lying there.
        log.warn('Could not empty ' + SOURCEMAP_DIR + '/: ' + e.message);
      }

      let moved = 0;
      for (const name of maps) {
        const source = path.join(from, name);
        // `output.compareBeforeEmit` skips writing an asset whose file is
        // already on disk with the same content. A map that was moved out
        // last time is not on disk, so it gets written again -- but a build
        // that somehow skips one should not fail here.
        if (!fs.existsSync(source)) continue;
        const target = path.join(to, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(source, target);
        moved += 1;
      }

      // A map only reads a stack from the bundle it was written with, so the
      // stash says which build that was.
      fs.writeFileSync(
        path.join(to, 'BUILD.txt'),
        [
          'Source maps for the DesignSense build that was in dist/.',
          'They are deliberately not deployed; see StashSourceMapsPlugin in',
          'webpack.config.js.',
          '',
          'Written ' + new Date().toISOString(),
          'Commit  ' + commitRef(),
          '',
        ].join('\n')
      );
      log.info(
        moved +
          ' source maps moved to ' +
          SOURCEMAP_DIR +
          '/, out of the published build'
      );
    });
  }
}

// The sample dataset that ships with the app: a CSV and its pictures, which
// nothing imports -- the CSV names its own files and the loader fetches them
// by URL (see src/data/loader.js).
const SAMPLE_DIR = 'samples';

/** Every file under `dir`, deepest included, as absolute paths. */
function filesUnder(dir) {
  let found = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found = found.concat(filesUnder(full));
    else found.push(full);
  });
  return found;
}

/**
 * Copies the sample dataset into the build, byte for byte.
 *
 * As emitted assets rather than a copy on disk, so that `webpack serve` hands
 * them out of memory too -- the app's first screen reads this sample, in
 * development as much as in a deployed build -- and so that `output.clean`
 * counts them as part of the build rather than sweeping them away.
 */
class CopySamplePlugin {
  apply(compiler) {
    const { RawSource } = compiler.webpack.sources;
    const root = path.resolve(__dirname, SAMPLE_DIR);
    compiler.hooks.thisCompilation.tap('CopySamplePlugin', (compilation) => {
      // So a picture added to the folder is picked up on a rebuild.
      compilation.contextDependencies.add(root);
      compilation.hooks.processAssets.tap(
        {
          name: 'CopySamplePlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          filesUnder(root).forEach((file) => {
            const name =
              SAMPLE_DIR +
              '/' +
              path.relative(root, file).split(path.sep).join('/');
            compilation.emitAsset(name, new RawSource(fs.readFileSync(file)));
          });
        }
      );
    });
  }
}

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
    // The app, and the guide as a page of its own (see src/guide/page.js),
    // which never loads the app: Vue and the guide's shell, a twentieth of
    // the app's size.
    entry: {
      bundle: './src/main.js',
      wiki: './src/guide/page.js',
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      // Code fetched on demand, such as the 3D viewer. Hashed, so a new
      // release never serves a chunk cached from the last one.
      chunkFilename: '[name].[contenthash:8].js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext][query]',
      publicPath: ASSET_PATH,
      clean: true,
    },

    // Hidden, not linked: the maps are written but the bundles do not point at
    // them, and StashSourceMapsPlugin then takes them out of `dist` entirely.
    devtool: isProduction ? 'hidden-source-map' : 'eval-cheap-module-source-map',

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

        // docs/guide.md is the guide (see src/guide/GuideDoc.vue): rendered
        // to HTML here, with html-loader turning the pictures it names by
        // relative path -- the paths GitHub follows too -- into assets of the
        // build.
        {
          test: /\.md$/i,
          use: [
            { loader: 'html-loader', options: { minimize: false } },
            path.resolve(__dirname, 'build/markdown-loader.js'),
          ],
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
        chunks: ['bundle'],
      }),
      // The guide's page carries the guide in its HTML, so it reads without a
      // script and a search engine sees all of it; the template asks for
      // docs/guide.md itself, through the rule above. Its stylesheet goes in
      // the page too, so the text is dressed before the script arrives.
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/wiki.html'),
        filename: 'wiki/index.html',
        chunks: ['wiki'],
        templateParameters: {
          site: SITE,
          styles: fs.readFileSync(
            path.resolve(__dirname, 'src/guide/guide.css'),
            'utf8'
          ),
        },
      }),
      new DiscoveryFilesPlugin(),
      new CopySamplePlugin(),
      // Only for a production build that is written: `webpack serve` keeps its
      // assets in memory, where there is no file to move and no deploy to keep
      // them out of.
      ...(isProduction && !isServed ? [new StashSourceMapsPlugin()] : []),
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
