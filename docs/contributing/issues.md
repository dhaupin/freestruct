
## Cache Busting Feature

**Status: IMPLEMENTED in v0.1.1**

### Problem
- CDNs (CloudFlare, Fastly, CloudFront) cache aggressively
- Basic Cache-Control meta tags are ignored by CDNs
- SSG asset hashing only covers their own assets, not freestruct-injected content
- Downstream CDNs don't know freestruct updated the build

### Solution (Implemented)
1. **Content hash generation** - inject.js now generates SHA1 build hash per build
2. **Version meta tag** - `<meta name="freestruct-build" content="{hash}">` injected into every page
3. **CloudFlare API integration** - Optional config in `ssr-config.yml`:
   ```yaml
   cacheBusting:
     provider: cloudflare
     apiToken: $CLOUDFLARE_API_TOKEN  # set in GitHub Secrets
     zoneId: $CLOUDFLARE_ZONE_ID      # get from CloudFlare dashboard
   ```
4. **Auto-purge on build** - Calls CloudFlare API post-inject to purge all site caches

### Usage
1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` to GitHub repo Secrets
2. Uncomment cacheBusting config in `ssr-config.yml`
3. On next build, freestruct will:
   - Generate unique build hash
   - Inject into all HTML pages
   - Call CloudFlare API to purge cache

### Future Enhancements
- Support more CDN providers (Fastly, CloudFront, Akamai)
- Add version query param to canonical URLs
- GitHub Actions cache busting for GitHub Pages specifically
