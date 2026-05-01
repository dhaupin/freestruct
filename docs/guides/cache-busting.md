---
title: Cache Busting
description: Ensure your content is always fresh with Freestruct's cache busting system
---

# Cache Busting

Freestruct provides a built-in cache busting system that ensures your content is always fresh, regardless of which CDN or caching layer sits in front of your site. It works **agnostic of your SSG** - just runs post-build on your output HTML.

## How It Works

Every build generates a unique **build hash** that's injected into your HTML. This hash changes on every build, ensuring:

1. **Asset cache busting** - CSS, JS, and images get `?v={hash}` query params
2. **Meta tag** - Hash visible in page source for debugging
3. **Optional canonical hash** - Add `?v={hash}` to canonical URLs if needed
4. **CDN purge hooks** - Run purge commands after each build

## What's Injected

Every HTML page gets:

```html
<meta name="freestruct-build" content="a1b2c3d4">
```

Assets in your HTML get cache-busted automatically:

```html
<!-- Before -->
<link rel="stylesheet" href="/assets/app.css">
<script src="/assets/app.js"></script>
<img src="/images/logo.png">
<link rel="font" href="/fonts/myfont.woff2">

<!-- After each build -->
<link rel="stylesheet" href="/assets/app.css?v=a1b2c3d4">
<script src="/assets/app.js?v=a1b2c3d4"></script>
<img src="/images/logo.png?v=a1b2c3d4">
<link rel="font" href="/fonts/myfont.woff2?v=a1b2c3d4">
```

Supported assets: CSS, JS, images (png, jpg, gif, svg, webp), icons (ico), fonts (woff, woff2, ttf, otf), wasm, json.

## Configuration

Add to `ssr-config.yml`:

```yaml
cacheBusting:
  # Asset query params (default: true)
  # Adds ?v={hash} to CSS, JS, and images automatically
  assetQueryParam: true
  
  # Hash in canonical URLs (default: false)
  # Enable if your CDN doesn't invalidate on deploy
  hashInCanonicalUrl: false
  
  # Hash generation (default: true - always on)
  hash: true
  
  # Optional: run purge commands after injection
  purge:
    - name: cloudflare
      command: >
        curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache"
        -H "Authorization: Bearer $CLOUDFLARE_TOKEN"
        -H "Content-Type: application/json"
        -d '{"files":["$SITE_URL/*"]}'
```

### Options

These settings control cache busting behavior:

| Option | Default | Description |
|--------|---------|-------------|
| `assetQueryParam` | true | Add `?v={hash}` to CSS, JS, image URLs |
| `hashInCanonicalUrl` | false | Add `?v={hash}` to canonical URLs |
| `hash` | true | Always generate build hash |

## Environment Variables

In purge commands, these variables are available:

| Variable | Description |
|----------|-------------|
| `$SITE_URL` | Your site URL from config |
| `$BUILD_HASH` | The hash for this build |
| `$OUTPUT_DIR` | Your build output directory |

## Supported CDNs

The purge system runs **any shell command**, so it supports:

- **CloudFlare** - API purge
- **Fastly** - Purge API or surrogate keys
- **CloudFront** - Invalidation
- **Akamai** - Cache purge
- **Custom scripts** - Run your own purge logic
- **CI hooks** - Trigger GitHub Actions, etc.

## ⚠️ Security Warning

The purge hooks feature runs commands from your `ssr-config.yml` via `execSync`.

**Only run trusted commands.** If your config file is compromised, attackers can execute arbitrary code on your build server.

Best practices:
- Use environment variables for secrets (not hardcoded in config)
- Review all purge commands before running
- Consider disabling in CI: set `enablePurge: false`

### Examples

**CloudFlare** - API-based cache purge:

```yaml
purge:
  - name: cloudflare
    command: curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" -H "Authorization: Bearer $CLOUDFLARE_TOKEN" -H "Content-Type: application/json" -d '{"files":["$SITE_URL/*"]}'
```

**Fastly** - Purge all endpoints:

```yaml
purge:
  - name: fastly
    command: curl -X POST "https://api.fastly.com/service/$FASTLY_SERVICE_ID/purge_all" -H "Fastly-Key: $FASTLY_API_KEY"
```

**Custom** - Run your own purge script:

```yaml
purge:
  - name: my-cdn
    command: ./scripts/purge.sh $SITE_URL $BUILD_HASH
```

## Frame-Agnostic

Freestruct doesn't care what SSG you use. It only looks at the HTML files after they're built:

- Jekyll `_site/`
- Hugo `public/`
- Docusaurus `build/`
- MkDocs `site/`
- VitePress `.vitepress/dist/`
- Anything else with HTML output

The cache busting works the same way - just point Freestruct at your output folder.

## Debugging

Check if cache busting is working:

1. View page source
2. Look for `<meta name="freestruct-build">`
3. Check assets have `?v=...` query params
4. Each build should show a different hash

## CDN Cache Headers

HTML meta cache headers don't work - CDNs ignore them. Set cache headers in your CDN config, not in HTML.

### Recommended Headers

Set these in your CDN (CloudFlare, Fastly, CloudFront, etc.):

| Asset Type | Cache-Control | Notes |
|------------|---------------|-------|
| HTML | `no-cache, max-age=0` | Always fetch fresh |
| CSS/JS | `public, max-age=31536000, immutable` | Cache forever, bust via ?v= |
| Images | `public, max-age=31536000, immutable` | Cache forever, bust via ?v= |
| Fonts | `public, max-age=31536000, immutable` | Cache forever, bust via ?v= |

### CloudFlare (Page Rules)

Set cache rules per file type:

```
# HTML - don't cache
*.yoursite.com/*.html
Cache-Control: no-cache, max-age=0

# Static assets - cache long
*.yoursite.com/assets/*
Cache-Control: public, max-age=31536000
```

### CloudFront (Behaviors)

Configure cache policies:

```
# HTML cache policy
- Cache-Control policy: Cache no-cache

# Static assets cache policy  
- Cache-Control policy: Cache immutable
- Query string forwarding: None (important!)
```

### Why This Works

With freestruct's asset query params:
1. Build runs → assets get `?v=abc123`
2. CDN sees new URL (`app.css?v=abc123`) → fetches from origin
3. CDN caches `app.css?v=abc123` for 1 year
4. Next deploy → assets get `?v=xyz789`
5. CDN sees new URL → fetches fresh, caches new version

The `?v=` makes each build a unique URL, so CDN always fetches once, then serves from cache.