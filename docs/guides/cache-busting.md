# Cache Busting

freestruct provides a built-in cache busting system that ensures your content is always fresh, regardless of which CDN or caching layer sits in front of your site.

## How It Works

Every build generates a unique **build hash** that's injected into your HTML. This hash changes on every build, ensuring:

1. **CDN cache invalidation** - The unique content forces CDNs to fetch fresh HTML
2. **Browser cache bypass** - Query params on canonical URLs break browser caching
3. **Verification** - The hash is visible in page source for debugging

## What's Injected

Every HTML page gets:

```html
<meta name="freestruct-build" content="a1b2c3d4">
<link rel="canonical" href="https://yoursite.com/page?v=a1b2c3d4">
```

## Configuration

Add to `ssr-config.yml`:

```yaml
cacheBusting:
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

### Examples

**CloudFlare:**
```yaml
purge:
  - name: cloudflare
    command: curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" -H "Authorization: Bearer $CLOUDFLARE_TOKEN" -H "Content-Type: application/json" -d '{"files":["$SITE_URL/*"]}'
```

**Fastly:**
```yaml
purge:
  - name: fastly
    command: curl -X POST "https://api.fastly.com/service/$FASTLY_SERVICE_ID/purge_all" -H "Fastly-Key: $FASTLY_API_KEY"
```

**GitHub Actions Cache:**
```yaml
purge:
  - name: gh-pages
    command: echo "Build $BUILD_HASH complete - GitHub Pages will deploy automatically"
```

**Custom Script:**
```yaml
purge:
  - name: my-cdn
    command: ./scripts/purge.sh $SITE_URL $BUILD_HASH
```

## No Configuration Required

The hash is **always generated and injected** - even without purge commands. This means:

- Without CDN config: You still get the build hash in meta + canonical
- CDNs see new content: The hash changes HTML fingerprint
- Browsers: Query params on canonical break stale caches

## Debugging

Check if cache busting is working:

1. View page source
2. Look for `<meta name="freestruct-build">`
3. Check canonical URL has `?v=...` query param
4. Each build should show a different hash