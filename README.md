# DesignSense

A design space exploration interface. Load a collection of generated design
options — their images, their 3D models, and the inputs and outputs behind
them — then filter it, compare options side by side, keep a shortlist, rate
what you like, and read which inputs drive which outputs.

DesignSense came out of a design study with practitioners in the built
environment; the [paper](https://journals.sagepub.com/doi/10.1177/14780771241260854)
describes the research behind it.

It runs in two modes. **Lite** narrows the collection with filters: brush a
chart, and each brush becomes a chip you can remove. **Expert** keeps an
expressive selection instead — replace, add, subtract, toggle, intersect —
along with panel editing, clustering and the sensitivity reading.

## Loading data

A study is a CSV, optionally beside its images and models. It can come from a
link to a CSV, a file on your computer, or a link to a folder on a web server
holding `data.csv` and its assets.

Columns follow a convention:

| Column | Meaning |
| --- | --- |
| `in:width` | a design parameter |
| `out:cost` | a result |
| `min:cost`, `max:daylight` | a result where lower, or higher, is better |
| `img`, `img_2`, `image 3` | views of the option, in that order |
| `model3d` | a 3D model: `.glb`, `.gltf`, `.obj` or `.json` |

Anything else is read as a plain dimension. A study written for
[Design Explorer](https://tt-acm.github.io/DesignExplorer/) loads as it is:
the `in:`/`out:` columns and `img` are the same convention, and its `threeD`
column of three.js `.json` scenes is read too. `testdata/` holds a small
synthetic study — 24 options, several with more than one view, four with
models — for trying the media and sensitivity features without a server.

## Running it

```sh
npm install
npm start
```

That serves the app at `http://localhost:8080`. For a production build:

```sh
npm run build-prod
```

which writes `dist/`, ready to serve as static files.

**On Node versions:** the repo builds on Node 22 — `.nvmrc` pins 22.14.0, and
`netlify.toml` gives the deploy the same version. Node 18.12 is the floor the
build tools ask for. The same Node runs the evaluation harness under `eval/`,
which needs 18 or newer for `fetch`.

**On cloud folders:** the build needs no API keys of any kind. Google Drive
folders are not read: listing one needs a key from the Google Cloud console,
which a browser app cannot keep to itself, as every visitor's browser would
carry it. OneDrive folders are read where Microsoft still allows it, which is
not for an account whose OneDrive has moved to SharePoint, however the folder
is shared. Both say so and suggest a web server instead, which needs no key:
the app fetches `<folder>/data.csv` and resolves the file names in it against
the same folder. A GitHub repository serves one through `raw.githubusercontent.com`.

## License

MIT — see [LICENSE](LICENSE).
