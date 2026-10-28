---
title: Feature Roadmap
description: Planned features and open issues
nav_order: 13
---

## Cache Busting Feature

**Status: complete in v0.1.1** (verified)

### Problem
- CDNs (CloudFlare, Fastly, CloudFront) cache aggressively
- Basic Cache-Control meta tags are ignored by CDNs
- SSG asset hashing only covers their own assets, not Freestruct-injected content
- Downstream CDNs don't know Freestruct updated the build

### Solution (Implemented)
Freestruct now provides **two independent mechanisms**:

1. **Automatic Hash Injection** (always on):
   - SHA1 build hash derived per build from config + sorted pre-injection page content
   - Injects `<meta name="freestruct-build" content="{hash}">` into every page
   - Adds `?v={hash}` query params to asset URLs
   - No configuration needed - works out of the box

2. **Purge Hooks** (optional):
   - Run ANY shell command post-build
   - Supports any CDN or cache system
   - Config in `freestruct.config.yml`:
     ```yaml
     cacheBusting:
       purge:
         - name: cloudflare
           command: curl -X DELETE "https://api.cloudflare.com/..." -H "Authorization: Bearer $TOKEN"
     ```
   - Gated behind `runHooks: true` (off by default)
   - Available variables: `$SITE_URL`, `$BUILD_HASH`, `$OUTPUT_DIR`

### Why It's Agnostic
- Hash is always injected (no CDN config required)
- Purge hooks use standard shell - no hardcoded API integrations
- Works with GitHub Pages, Netlify, Vercel, self-hosted, any CDN
- User controls exact purge commands in config

### Verified Working
- Build hash appears in page source
- Asset URLs include `?v={hash}` query params
- The hash flips when page content changes (content-derived, not timestamped)

### Future Enhancements
- Could add built-in Fastly/CloudFront providers (but shell hooks cover it)
- Could add cache headers to HTTP responses (server-specific)

## Related

- [Voice & Style](/contributing/style) - How Freestruct docs are written
- [Engineering Decisions](/engineering-decisions) - Where shipped decisions land
