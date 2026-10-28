---
title: Troubleshooting
description: Common Freestruct issues and their fixes - config errors, missing meta, link check failures and CI exit codes, with the command that shows each problem
nav_order: 10
---
Common issues and solutions.

# Troubleshooting

## Errors

### "Cannot find module 'js-yaml'"

```text
Error: Cannot find module 'js-yaml'
```

**Fix:** Freestruct runs through the Freestruct npm package, which ships `js-yaml` as its own dependency - install the package rather than the dependency by hand:

```bash
npm install --save-dev freestruct
# or
yarn add -D freestruct
```

Running the engine from a repo checkout instead? Install `js-yaml` there (`npm install js-yaml`) - that is the only case where it is a manual step.

---

### "Config file not found"

```text
Error: Config file not found: docs/freestruct.config.yml
```

**Fix:** Create the config file:

```bash
npx freestruct path/to/output
```

Freestruct looks for `docs/freestruct.config.yml` first (the legacy name `docs/ssr-config.yml` also works), searching upward from your current directory.

---

### "No HTML files found"

```text
Found 0 HTML files
```

**Fix:** Check your output path - it should contain `.html` files:

```text
# If using Jekyll
npx freestruct docs/_site

# If using Hugo
npx freestruct public
```

---

### Duplicate meta tags

**Symptom:** Pages have duplicate og:title, description, etc.

**Fix:** None needed in freestruct - injection is missing-only, so it never adds a tag the page already has. Duplicates come from the page or its layout shipping the same tag twice; deduplicate at the source (the page template). Retired `preserveExistingMeta` produces only a config warning, not a fix.

---

## Gotchas

### 1. Config indentation

Use **spaces** (not tabs) in YAML:

```yaml
# CORRECT
site:
  name: My Site

# WRONG
site:
	name: My Site
```

---

### 2. Minify breaks pages

Minify is **experimental** - it may break some pages:

```yaml
# Test with minify: false first
minify: false  # off by default
```

If pages break, keep minify off.

---

### 3. Cache not clearing

If CDN caches don't update:

1. Check the build hash changed: `grep freestruct-build file.html`
2. Verify asset URLs have new `?v=` param
3. Manually purge CDN if needed

The hash should change every build.

---

### 4. Jekyll _includes collision

Template files live in `engine/_freestruct/` inside the installed package and are used automatically; a staged `docs/_freestruct/` copy (not `_includes/`, which collides with Jekyll) always wins:

```text
docs/_freestruct/           <- staged: your overrides (optional)
  inject-header.html
  inject-footer.html
  inject-brand.html

node_modules/freestruct
  engine/_freestruct/       <- packaged: the canonical copy used otherwise
```

This avoids Jekyll's `_includes/` folder.

---

## Debug Mode

There is no separate debug mode - the default run already narrates to stdout (build hash, page count, per-file warnings and every artifact it writes). The layered tools:

1. `npx freestruct validate` first: a config-only preflight that prints diagnostics (unknown/retired key warnings included) without touching the output tree
2. `npx freestruct audit` on the baked output: it names every per-page head gap (missing title/description/canonical, the 404 noindex contract, sitemap/robots) with FAIL/WARN lines and exit 1 when something regressed
3. Read the `[freestruct] config warning` and `[freestruct] page warning` lines in the run output - nothing dies silently
4. `npx freestruct --tolerant` reports fatal errors with exit `0` for CI tolerance runs
5. Verify config keys against the [Freestruct.config Reference](/guides/freestruct-config) and the [CLI Reference](/guides/cli)

---

## Getting Help

- Check [GitHub Issues](https://github.com/dhaupin/freestruct)
- Search existing discussions
- Open a new issue with:
  - Error message
  - Your config (redact secrets)
  - SSG you're using

## Related

- [Cache Busting FAQ](/guides/cache-busting-faq) - URL freshness errors covered there
- [CI/CD](/guides/cicd) - Pipeline-specific failures
- [Getting Started](/getting-started) - Restart from the basics