
## Cache Busting Feature

freestruct should support cache busting beyond the SSG's built-in mechanisms.

### Problem
- CDNs (CloudFlare, Fastly, CloudFront) cache aggressively
- Basic Cache-Control meta tags are ignored by CDNs
- SSG asset hashing only covers their own assets, not freestruct-injected content
- Downstream CDNs don't know freestruct updated the build

### Proposed Solution
Add cache busting to `inject.js`:

1. **Content hash generation** - Generate hash of all injected SEO and inject into:
   - `<link rel="canonical">` as query string: `?v={hash}`
   - JSON-LD `@id` fields
   - Open Graph URLs

2. **CloudFlare API integration** - Optional config in `ssr-config.yml`:
   ```yaml
   cacheBusting:
     provider: cloudflare
     apiToken: $CLOUDFLARE_TOKEN  # env var
     zoneId: xxx
   ```

3. **Purge on build** - Call provider API post-inject

4. **SSG bridge** - Support existing SSG cache plugins:
   - Gatsby `gatsby-plugin-cache-busting`
   - Next.js ` Cache-Control` headers
   - Vite plugin hooks

### Related
- See [CloudFlare Cache Purge API](https://developers.cloudflare.com/api/operations/zone-purge)
- See [Fastly Surrogate Keys](https://docs.fastly.com/en/guides/about-surrogate-keys)
