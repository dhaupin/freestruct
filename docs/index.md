---
layout: home
title: freestruct
description: Post-build SEO layer for any static site generator.
---

<section class="how-it-works">
  <h2>How it works</h2>
  
  <div class="steps">
    <div class="step">
      <div class="step-content">
        <h3>Build your docs</h3>
        <p>Jekyll, Hugo, Docusaurus, MkDocs, VitePress — doesn't matter. Point freestruct at your output.</p>
      </div>
    </div>
    
    <div class="step">
      <div class="step-content">
        <h3>Run freestruct</h3>
        <p>One command injects SEO tags, OG cards, Twitter meta, sitemap, and cache-busting.</p>
        <pre><code>node docs/lib/inject.js</code></pre>
      </div>
    </div>
    
    <div class="step">
      <div class="step-content">
        <h3>Deploy</h3>
        <p>Done. Every page has proper meta. CDNs see fresh content. No plugins, no template hacks.</p>
      </div>
    </div>
  </div>
</section>

<section class="features-grid">
  <h2>What's included</h2>
  
  <div class="features">
    <div class="feature">
      <h3>Open Graph + Twitter Cards</h3>
      <p>Social previews for LinkedIn, Twitter, Slack. Your docs look good everywhere.</p>
    </div>
    
    <div class="feature">
      <h3>Canonical URLs</h3>
      <p>Proper canonical tags on every page. Search engines index the right URL.</p>
    </div>
    
    <div class="feature">
      <h3>Cache-busting hash</h3>
      <p>Unique hash per build. CDNs fetch fresh content on every deploy.</p>
    </div>
    
    <div class="feature">
      <h3>Auto sitemap</h3>
      <p>Generates sitemap.xml with all pages. Search engines find everything.</p>
    </div>
    
    <div class="feature">
      <h3>CDN purge hooks</h3>
      <p>CloudFlare, Fastly, CloudFront — run purge commands automatically.</p>
    </div>
    
    <div class="feature">
      <h3>PageFind search</h3>
      <p>⌘K search baked in. Indexes automatically post-build.</p>
    </div>
  </div>
  
  <p><a href="/configuration">→ Full config reference</a></p>
</section>

<section class="guides-grid">
  <h2>Quick links</h2>
  
  <div class="guides">
    <a href="/getting-started" class="guide">
      <h3>Getting Started</h3>
      <p>Up in 5 minutes</p>
    </a>
    
    <a href="/guides/ssr-config" class="guide">
      <h3>ssr-config.yml</h3>
      <p>All options</p>
    </a>
    
    <a href="/guides/cache-busting" class="guide">
      <h3>Cache Busting</h3>
      <p>How the hash works</p>
    </a>
    
    <a href="/guides/post-render-hooks" class="guide">
      <h3>Post-Render Hooks</h3>
      <p>Beyond SEO</p>
    </a>
  </div>
</section>

<section class="comparison">
  <h2>vs. doing it manually</h2>
  
  <table>
    <thead>
      <tr>
        <th></th>
        <th>freestruct</th>
        <th>Manual</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Works with any SSG</td>
        <td class="check">✓</td>
        <td class="check">✓</td>
      </tr>
      <tr>
        <td>One-time config</td>
        <td class="check">✓</td>
        <td class="x">✗</td>
      </tr>
      <tr>
        <td>Cache busting</td>
        <td class="check">✓</td>
        <td class="x">✗</td>
      </tr>
      <tr>
        <td>No template changes</td>
        <td class="check">✓</td>
        <td class="x">✗</td>
      </tr>
    </tbody>
  </table>
</section>
