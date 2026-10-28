# Freestruct init kit

This is the consumer scaffold kit (prestruct's `init/` pattern, sized to Freestruct): the minimum a brand-new project copies in to be Freestruct-ready in minutes. Freestruct runs AFTER your static site generator builds, so the kit is deliberately SSG-agnostic - your Jekyll/Hugo/Docusaurus/MkDocs setup stays untouched.

## What's in the kit

```
init/
  VERSION                  - the freestruct release this kit is stamped with
  README.md                - this file
  docs/
    freestruct.config.yml  - starter config (site.name + site.url required)
    _freestruct/           - template copies (synced from engine/_freestruct)
```

## Start (copy + go)

From YOUR project root:

```bash
npm install --save-dev freestruct
cp -r node_modules/freestruct/init/docs .
```

Then:

1. Edit `docs/freestruct.config.yml`: `site.name` and `site.url` are required; adjust `site.description` to fit. The starter also seeds the family identity - an `author` block (the Creadev.org founder) and a `jsonLd` maintainer Person - so scaffolded ports ship ownership from birth; set the maintainer handle to your own.
2. Let your SSG build. `npx freestruct` discovers the output dir (default `docs/_site`; override via the `outputDir` config key or a positional CLI argument).
3. Verify: `docs/_site` gains `sitemap.xml`, `robots.txt`, `feed.xml` and (when missing) a `404.html`; injected pages carry canonical/OG tags and a `freestruct-build` marker.
4. Customize templates only if you need to: the packaged engine templates are used automatically when no staged copy exists. To customize, edit `docs/_freestruct/` copies (which you just copied in) - a staged template always wins over the package-shipped one.

## Why a kit (not a lucky guess)

Copying this kit means your first run exercises the exact shape the test battery and the tarball e2e verify: staged config + staged templates next to the docs folder, discovered by walking up from your project root.
