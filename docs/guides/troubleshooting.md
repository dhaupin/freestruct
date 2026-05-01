---
title: Troubleshooting
description: Common issues and how to fix them
---
Common issues and solutions.

## Errors

### "Cannot find module 'js-yaml'"

```
Error: Cannot find module 'js-yaml'
```

**Fix:** Install the dependency:

```bash
npm install js-yaml
# or
yarn add js-yaml
```

---

### "Config file not found"

```
Error: Config file not found: docs/ssr-config.yml
```

**Fix:** Create the config file:

```bash
node docs/lib/inject.js path/to/output
```

Freestruct looks for `docs/ssr-config.yml` in the repo root.

---

### "No HTML files found"

```
Found 0 HTML files
```

**Fix:** Check your output path - it should contain `.html` files:

```bash
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
# ✅ Correct
site:
  name: My Site

# ❌ Wrong
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

Template files are in `docs/_freestruct/` (not `_includes/`):

```
docs/_freestruct/
  inject-header.html
  inject-footer.html
  inject-brand.html
```

This avoids Jekyll's `_includes/` folder.

---

## Debug Mode

No built-in debug mode yet. To debug:

1. Add temporary console.log to inject.js
2. Check output HTML directly
3. Verify config with: `node -e "console.log(require('./docs/ssr-config.yml'))"`

---

## Getting Help

- Check [GitHub Issues](https://github.com/dhaupin/freestruct)
- Search existing discussions
- Open a new issue with:
  - Error message
  - Your config (redact secrets)
  - SSG you're using