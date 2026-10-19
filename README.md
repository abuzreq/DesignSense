<img src="icons/favicon.svg" width="96" height="96" alt="DesignSense logo: a D with five brushed ranges inside it that spell an S">

# DesignSense

A design space exploration interface. Load a collection of generated design
options — their images, their 3D models, and the inputs and outputs behind
them — then filter it, compare options side by side, keep a shortlist, rate
what you like, and read which inputs drive which outputs.

**[Open DesignSense](https://designsense.app/)** ·
**[Read the guide](docs/guide.md)**: how a study is made (Grasshopper and
Colibri, or any tool that writes a CSV), the file format, loading it, and the
four tasks DesignSense is for: understand the design space, narrow it, decide,
and share the result. The same file is the guide inside the app (Help ▸ Guide)
and the page at [designsense.app/wiki](https://designsense.app/wiki/), where
it also has a search and examples to try.

<a href="https://youtu.be/4A_yEZ4cex4"><img src="docs/img/video-intro.jpg" width="640" alt="DesignSense in one minute: 648 generated window designs, and the four worth keeping. Opens the video on YouTube."></a>

**Watch:** [the one-minute intro](https://youtu.be/4A_yEZ4cex4) ·
[the video tutorial](https://youtu.be/KHVPWmzlfpQ), eight minutes that go
through the app's guided tour step by step.

DesignSense came out of a design study with practitioners in the built
environment; the [paper](https://journals.sagepub.com/doi/10.1177/14780771241260854)
describes the research behind it.

It runs in two modes. **Lite** narrows the collection with filters: brush a
chart, and each brush becomes a chip you can remove. **Expert** keeps an
expressive selection instead — replace, add, subtract, toggle, intersect —
along with panel editing, clustering and the sensitivity reading.

## Loading data

A study is a folder: `data.csv`, with a row for each option, beside the
images and 3D models it names. Open the folder (or the CSV alone) from your
computer, or paste a link to it on a web server or in a shared Google Drive
folder (on the hosted site; see *On cloud folders* below). A study written for
[Design Explorer](https://tt-acm.github.io/DesignExplorer/), such as a folder
from Colibri in Grasshopper, loads as it is.

The guide has the rest: [how the data is made](docs/guide.md#generate),
[what the column names mean](docs/guide.md#prepare) and
[the ways to load it](docs/guide.md#load).

`testdata/` holds a small synthetic study — 24 options, several with more than
one view, four with models — for trying the media and sensitivity features
without a server.

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

**On cloud folders:** a shared Google Drive folder is read where the build
has a Google API key. Listing a folder is the one thing Drive refuses without
one, and a browser app cannot keep a key to itself, since every visitor's
browser carries it; the hosted site at designsense.app has one, restricted to
its own address in the Google Cloud console. A build of your own reads the
key from `GOOGLE_API_KEY`, either in the environment or in a `.env` file at
the repository root (copy `.env.example` and fill it in; `.env` is ignored by
git). Create the key in the Cloud console with the Google Drive API enabled,
and restrict it to the address your copy is served from. Without a key, a
Drive link is refused with a message that points at the hosted site. Reading
a folder costs 300 quota units a visit, however many pictures it holds, as
those come from Drive's thumbnail service, which asks for no key.

OneDrive folders are read where Microsoft still allows it, which is not for
an account whose OneDrive has moved to SharePoint, however the folder is
shared. A web server needs no key: the app fetches `<folder>/data.csv` and
resolves the file names in it against the same folder. A GitHub repository
serves one through `raw.githubusercontent.com`.

## License

MIT — see [LICENSE](LICENSE).
