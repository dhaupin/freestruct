---
title: Troubleshooting
description: Common issues and how to fix them
nav_order: 10
---
Common issues and solutions.

## Errors

### "Cannot find module 'js-yaml'"

```text
Error: Cannot find module 'js-yaml'
```

**Fix:** Freestruct runs through the Freestruct npm package, which ships
`js-yaml` as its own dependency - install the package rather than the
dependency by hand:

```bash
npm install --save-dev freestruct
# or
yarn add -D freestruct
```

Running the engine from a repo checkout instead? Install `js-yaml` there
(`npm install js-yaml`) - that is the only case where it is a manual step.

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
node docs/lib/inject.js docs/_site

# If using Hugo
node docs/_site
```

---

### Duplicate meta tags

**Symptom:** Pages have duplicate og:title, description, etc.

**Fix:** Set `preserveExistingMeta: false` in config:

```yaml
preserveExistingMeta: false
```

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

No built-in debug mode yet. To debug:

1. Add temporary console.log to inject.js
2. Check output HTML directly
3. Verify config keys against the Configuration Reference page (Freestruct.config Reference in the menu).

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