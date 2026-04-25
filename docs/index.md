---
layout: home
title: Freestruct
description: Post-build SEO and search layer for static doc sites.
---

<section class="intro">
  <p>Freestruct adds SEO tags and search to your static docs after build. It works with any SSG - Jekyll, Hugo, Docusaurus, MkDocs, VitePress. Run it once, and every page gets proper meta tags, Open Graph cards, Twitter meta, a sitemap, and cache-busting hashes.</p>
</section>

<section class="how-it-works">
  <h2>How it works</h2>
  
  <div class="steps">
    <div class="step">
      <div class="step-content">
        <h3>Build your docs</h3>
        <p>Run your SSG like you always do. Jekyll, Hugo, Docusaurus, MkDocs - Freestruct doesn't care what you use.</p>
      </div>
    </div>
    
    <div class="step">
      <div class="step-content">
        <h3>Run Freestruct</h3>
        <p>A single command that reads your config, scans your output folder, and injects SEO into every HTML file.</p>
        <pre><code>node docs/lib/inject.js</code></pre>
      </div>
    </div>
    
    <div class="step">
      <div class="step-content">
        <h3>Deploy</h3>
        <p>Done. Your docs now have Open Graph tags, Twitter Cards, canonical URLs, sitemap.xml, and a unique hash that forces CDNs to fetch fresh content. No plugins, no template changes.</p>
      </div>
    </div>
  </div>
</section>

<section class="features-grid">
  <h2>What you get</h2>
  
  <div class="features">
    <div class="feature">
      <h3>Open Graph + Twitter Cards</h3>
      <p>Every page gets proper meta tags for social previews. LinkedIn, Twitter, Slack - your docs look good everywhere.</p>
    </div>
    
    <div class="feature">
      <h3>Canonical URLs</h3>
      <p>Proper canonical tags on every page. Search engines index the right URL, not duplicates.</p>
    </div>
    
    <div class="feature">
      <h3>Cache-busting Hash</h3>
      <p>Each build gets a unique hash injected into the HTML. CDNs see new content on every deploy - no manual purge needed.</p>
    </div>
    
    <div class="feature">
      <h3>Auto Sitemap</h3>
      <p>Freestruct generates sitemap.xml with all your pages. Search engines can crawl everything without help.</p>
    </div>
    
    <div class="feature">
      <h3>CDN Purge Hooks</h3>
      <p>Configure CloudFlare, Fastly, or CloudFront to purge automatically after each build. Your docs stay fresh.</p>
    </div>
    
    <div class="feature">
      <h3>PageFind Search</h3>
      <p>Freestruct includes PageFind for static search. Press ⌘K to search your docs. Indexes automatically after build.</p>
    </div>
  </div>
  
  <p><a href="/configuration">- Full configuration reference</a></p>
</section>

<section class="quickstart">
  <h2>Quick setup</h2>
  
  <p>Install the only dependency, create a config, run Freestruct:</p>
  
  <pre><code>npm install js-yaml

# Create docs/ssr-config.yml with your site info

node docs/lib/inject.js</code></pre>
  
  <p>That's it. See <a href="/getting-started">Getting Started</a> for the full guide.</p>
</section>

<section class="guides-grid">
  <h2>Guides</h2>
  
  <div class="guides">
    <a href="/getting-started" class="guide">
      <h3>Getting Started</h3>
      <p>Full setup in 5 minutes</p>
    </a>
    
    <a href="/guides/ssr-config" class="guide">
      <h3>Configuration</h3>
      <p>All available options</p>
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
  <h2>Freestruct vs manual setup</h2>
  
  <table>
    <thead>
      <tr>
        <th></th>
        <th>Freestruct</th>
        <th>Manual</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Works with any SSG</td>
        <td class="check">Yes</td>
        <td class="check">Yes</td>
      </tr>
      <tr>
        <td>Configure once</td>
        <td class="check">Yes</td>
        <td class="x">No</td>
      </tr>
      <tr>
        <td>Cache busting</td>
        <td class="check">Yes</td>
        <td class="x">No</td>
      </tr>
      <tr>
        <td>No template changes</td>
        <td class="check">Yes</td>
        <td class="x">No</td>
      </tr>
    </tbody>
  </table>
</section>
