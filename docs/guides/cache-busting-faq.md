---
title: Cache Busting FAQ
description: Common questions about Freestruct's cache busting system
---

# Cache Busting FAQ

## Why do I need this? My site is already built.

Every time you deploy, your SSG (Jekyll, Hugo, Docusaurus) generates fresh HTML. But here's the painful truth:

- **CDNs cache at the edge** - CloudFlare, Fastly, CloudFront all cache your HTML
- **Browser caches are aggressive** - Users may have locally cached your site
- **Intermediate proxies** - ISPs, corporate networks all cache

You rebuild your docs. Deploy. But users still see old content. You check the CMS/SSG - it says deployed. You check the CDN - it says everything is fine. But your user in Berlin is still seeing last week's version.

This is the "I'm so fucking sick of this" moment.

Freestruct solves this by injecting a unique hash into every build. The HTML is different. CDNs must re-fetch. Browser cache is bypassed via query params.

## Why can't I just use Cache-Control headers?

You can! But there's a catch:

1. **Meta Cache-Control tags are ignored by most CDNs** - They only respect HTTP headers
2. **Setting headers requires server access** - Not possible with GitHub Pages, Netlify basic, etc.
3. **Aggressive CDNs ignore everything** - CloudFlare's "Cache Everything" page rule doesn't care about your meta tags

The hash approach works because it changes the actual content. The CDN sees a new URL/HTML and can't serve its cache.

## What's the difference between the meta tag and canonical URL?

Two mechanisms for different layers:

1. **`<meta name="freestruct-build">`** - For debugging and verification. Shows which build is deployed.

2. **`?v=` query param on canonical** - This is the real cache buster. When a CDN sees a new URL, it treats it as new content.

Both are generated automatically. You don't need to do anything.

## Will this break my existing SEO?

No. It improves it:

- Canonical URLs with `?v=` are still valid canonicals
- Search engines understand versioned URLs
- The hash changes every build, but that's intentional - you want everything fresh

## My CDN already has auto-purge. Why do I need this?

Great! If your CDN properly purges on every deploy, you're lucky. But:

1. **Many setups don't** - GitHub Pages + CloudFlare needs manual purge
2. **Purge can fail silently** - API errors, rate limits, misconfigured zones
3. **Intermediate caches** - Proxies, CDNs in front of your CDN
4. **Stale references** - If any external site links to your old `?v=` version

The hash is your safety net. Even if purge fails, the new HTML breaks the cache.

## Does this work with GitHub Pages?

Yes! This is actually why we built it:

- GitHub Pages has no cache control
- GitHub's CDN can be slow to propagate
- Custom domains via CloudFlare need manual purge

With freestruct, every commit automatically busts caches. No manual purge needed.

## Does this work with Netlify/Vercel?

Yes! Both have their own CDNs:

- Netlify: May need asset pruning, hash helps
- Vercel: Edge caching is aggressive, hash ensures freshness

## What if I don't configure purge hooks?

**The hash still works!** 

Without purge hooks configured:
- Every build generates a new hash
- `<meta name="freestruct-build">` is injected
- Canonical URLs get `?v={hash}`
- CDNs see different content (different HTML fingerprint)
- Browser caches are bypassed

You get ~80% of the benefit automatically. Purge hooks are the bonus for aggressive cache layers.

## Can the hash collide? What if two builds have the same hash?

The hash is SHA1 of `JSON.stringify(config) + timestamp`. The timestamp is `Date.now()` in milliseconds. Collisions are practically impossible unless you:

1. Run two builds in the same millisecond
2. With identical config

Even then, it's not a security issue - just means the same hash for two builds. Very unlikely.

## Can I disable the hash?

Yes, but why would you? Add to config:

```yaml
cacheBusting:
  hash: false
```

We don't recommend this. The hash is what makes cache busting work.

## Does this work with SSGs other than Jekyll?

Yes! Freestruct is completely agnostic:

- **Jekyll** - `docs/_site` output
- **Hugo** - `public/` output  
- **Docusaurus** - `build/` output
- **Gatsby** - `public/` output
- **Any SSG** - Just point `outputDir` to your build folder

The hash injection happens after your SSG finishes. It doesn't care what generated the HTML.

## Will this slow down my builds?

Negligibly. The hash generation and injection adds ~10-50ms per page. For a typical docs site with 50-100 pages, that's under 5 seconds total.

## Can I use different hashes for different environments?

Yes! The hash includes your entire config. If you have:

```yaml
# Production
site:
  url: https://docs.example.com

# Staging  
site:
  url: https://staging.example.com
```

Each environment gets its own hash. Perfect for CI/CD pipelines with multiple environments.

## What's the difference between freestruct's cache busting and asset hashing?

SSGs often hash static assets (JS, CSS, images) with filenames like `app.a1b2c3d4.js`. This is great but:

1. **Only covers assets** - Not the HTML
2. **Requires SSG support** - Not all SSGs do this well
3. **Doesn't help CDN HTML cache** - The HTML is still cached

Freestruct complements asset hashing by handling the HTML layer. Use both together for maximum cache control.

## My site still shows old content. What do I do?

1. **Check the hash** - View page source, look for `freestruct-build`
2. **Hard refresh** - Ctrl+Shift+R (or Cmd+Shift+R)
3. **Incognito mode** - Test in a fresh browser
4. **Check CDN dashboard** - Look for purge status
5. **Wait** - Some CDNs take 5-30 minutes to fully propagate

If all else fails, manually purge your CDN cache. The hash is your backup - even with stale CDN cache, the next deploy will fix it.

## Is this secure? Can someone manipulate the hash?

No security concerns:

1. **Hash is internal** - Generated at build time, injected into HTML
2. **No security implications** - It's just a version identifier
3. **Doesn't expose config** - Only the hash travels with the page

## I want to test this. How do I verify it's working?

1. Deploy your site
2. View page source
3. Look for `<meta name="freestruct-build" content="...">`
4. Note the hash
5. Make a small change to any page
6. Rebuild and deploy
7. Check again - the hash should be different
8. Check canonical URL has new `?v=` parameter

You'll see the hash change every single deploy.

## Still have questions?

This is a pain we've all felt. If your specific scenario isn't covered, open an issue. We built this because we were tired of "why isn't my docs updating" at 2am.