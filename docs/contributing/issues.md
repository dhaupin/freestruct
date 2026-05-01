
## Cache Busting Feature

**Status: COMPLETE in v0.1.1** ✅

### Problem
- CDNs (CloudFlare, Fastly, CloudFront) cache aggressively
- Basic Cache-Control meta tags are ignored by CDNs
- SSG asset hashing only covers their own assets, not freestruct-injected content
- Downstream CDNs don't know freestruct updated the build

### Solution (Implemented)
freestruct now provides **two independent mechanisms**:

1. **Automatic Hash Injection** (always on):
   - SHA1 build hash generated per build from config + timestamp
   - Injects `<meta name="freestruct-build" content="{hash}">` into every page
   - Adds `?v={hash}` query param to canonical URLs
   - No configuration needed - works out of the box

2. **Purge Hooks** (optional):
   - Run ANY shell command post-build
   - Supports any CDN or cache system
   - Config in `ssr-config.yml`:
     ```yaml
     cacheBusting:
       purge:
         - name: cloudflare
           command: curl -X DELETE "https://api.cloudflare.com/..." -H "Authorization: Bearer $TOKEN"
     ```
   - Available variables: `$SITE_URL`, `$BUILD_HASH`, `$OUTPUT_DIR`

### Why It's Agnostic
- Hash is always injected (no CDN config required)
- Purge hooks use standard shell - no hardcoded API integrations
- Works with GitHub Pages, Netlify, Vercel, self-hosted, any CDN
- User controls exact purge commands in config

### Verified Working
- Build hash appears in page source
- Canonical URLs include `?v={hash}` query param
- Hash changes every build

### Future Enhancements
- Could add built-in Fastly/CloudFront providers (but shell hooks cover it)
- Could add cache headers to HTTP responses (server-specific)
