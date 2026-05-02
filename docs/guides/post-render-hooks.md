---
title: Post-Render Hooks
description: Use Freestruct as a build-time HTML processor for anything you need
nav_order: 16
---

# Beyond SEO: Post-Render HTML Processing

Freestruct isn't just for SEO. It's a **build-time HTML processor** that runs after your SSG completes. This opens up possibilities beyond meta tags.

## What Is Post-Render Processing?

```
Your SSG builds → Freestruct modifies → deploy
                 ↑
           This is your hook
```

Your static site generator (Jekyll, Hugo, Docusaurus) outputs HTML. Freestruct reads that HTML, gives you the full content in JavaScript, and lets you modify it before deploy.

## Why This Matters

### 1. Fix Legacy SSG Issues

Your Jekyll/Hugo version is ancient. Can't upgrade without breaking things. But you can use Freestruct to inject fixes:

```javascript
// Fix broken internal links
html = html.replace(/href="\/docs\/old-path/g, 'href="/docs/new-path');

// Inject emergency banner
html = html.replace('</body>', '<div class="banner">Maintenance in progress</div></body>');
```

### 2. A/B Testing Without Client-Side Bloat

```javascript
// Inject split-test script into specific pages
if (filePath.includes('pricing.html')) {
  html = html.replace('</head>', '<script src="/ab-test.js"></script></head>');
}
```

### 3. Conditional Content Injection

```javascript
// Different content for staging vs production
if (process.env.NODE_ENV === 'staging') {
  html = html.replace('</body>', '<div class="staging-badge">STAGING</div></body>');
}
```

### 4. Inject Analytics That Require HTML Changes

```javascript
// Some analytics need more than a script tag
if (config.analytics && config.analytics.gtag) {
  html = html.replace('</head>', '<script>gtag("config", "' + config.analytics.gtag + '");</script></head>');
}
```

### 5. Image Optimization Hooks

```javascript
// Add lazy loading to images that don't have it
html = html.replace(/<img (?!.*loading=)/g, '<img loading="lazy" ');
```

## Build Hook System

The Freestruct build runs as a Node.js script. You can extend it by modifying inject.js:

```javascript
// Add custom post-render logic in injectFile():
function injectFile(filePath, config, template, outputDir, buildHash) {
  let html = fs.readFileSync(filePath, 'utf8');

  // YOUR CUSTOM LOGIC HERE
  if (config.customHooks) {
    for (const hook of config.customHooks) {
      html = applyHook(html, hook);
    }
  }

  // ... rest of existing injection logic
}
```

Or use the **purge hooks** system to run arbitrary shell commands:

```yaml
cacheBusting:
  purge:
    - name: custom-inject
      command: node scripts/my-custom-injection.js
```

## Best Practice: Comment Your Modifications

**When you modify HTML in your build pipeline, tell your team.**

Post-render modifications can confuse developers who inspect the page and wonder "where did this come from?"

### Do This

```html
<!-- freestruct: Added staging banner -->
<div class="staging-badge">STAGING</div>

<!-- freestruct: Legacy link fix from v2.5 migration -->
<a href="/docs/new-path">

<!-- freestruct: Lazy loading added to all images -->
<img src="..." loading="lazy">
```

### Not This

```html
<!-- Just appeared after deploy, no idea why -->
<div class="staging-badge">

<!-- No comment, just modified links -->
<a href="/docs/new-path">
```

### Why This Matters

1. **Debugging** - Team members can trace changes back to source
2. **Auditing** - Security reviews can verify intentional modifications
3. **Onboarding** - New devs understand the build pipeline
4. **Maintenance** - Future upgrades won't accidentally break custom injections

Freestruct automatically adds this:

```html
<!-- Freestruct SEO -->
<meta name="freestruct-build" content="abc123">
<!-- Freestruct -->
```

Add your own markers following the same pattern.

## Security Considerations

When processing HTML at build time:

1. **Trust your config** - Don't let user input in ssr-config.yml execute arbitrary code
2. **Validate modifications** - Test your transformations don't break HTML
3. **Version control your hooks** - Keep custom scripts in repo, not hardcoded
4. **Comment changes** - See above

## Use Cases Summary

| Use Case | Example |
|----------|---------|
| Fix broken links | Redirect old URLs to new ones |
| Environment badges | Show STAGING/PRODUCTION banners |
| A/B testing | Inject test scripts on specific pages |
| Analytics | Add tracking tags that need HTML modification |
| Image optimization | Add lazy loading to all images |
| Build metadata | Inject timestamps, git info, version |
| Conditional features | Enable/disable features per environment |

## Related

- [Cache Busting](/guides/cache-busting) - Built-in hash system
- [Template](/guides/template) - How inject-brand.html works
- [ssr-config.yml](/guides/ssr-config) - Configuration reference
