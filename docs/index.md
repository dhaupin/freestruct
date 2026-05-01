---
layout: default
title: Freestruct
description: Post-build SEO and search layer for static doc sites.
---

<section class="intro">
  <p>Freestruct adds SEO tags and search to your static docs after build. It works with any SSG - Jekyll, Hugo, Docusaurus, MkDocs, VitePress. Run it once, and every page gets proper meta tags, Open Graph cards, Twitter meta, a sitemap, and cache-busting hashes.</p>
</section>

<section class="how-it-works">
  <h2>How it works</h2>
  
  <p class="section-intro">Freestruct runs after your SSG builds your site. It scans your output folder, reads a simple config, and injects SEO into every HTML file.</p>
  
  <div class="steps">
    <div class="step">
      <div class="step-content">
        <h3>1. Build your docs</h3>
        <p>Run your SSG like you always do. Jekyll, Hugo, Docusaurus, MkDocs - Freestruct doesn't care what you use. It only looks at the HTML files after they're built.</p>
      </div>
    </div>
    
    <div class="step">
      <div class="step-content">
        <h3>2. Run Freestruct</h3>
        <p>A single command that reads your config, scans your output folder, and injects SEO into every HTML file.</p>
        <pre><code>node docs/lib/inject.js</code></pre>
      </div>
    </div>
    
    <div class="step">
      <div class="step-content">
        <h3>3. Deploy</h3>
        <p>Done. Your docs now have Open Graph tags, Twitter Cards, canonical URLs, sitemap.xml, and a unique hash that forces CDNs to fetch fresh content. No plugins, no template changes.</p>
      </div>
    </div>
  </div>
</section>

<section class="features-grid">
  <h2>What you get</h2>
  
  <p class="section-intro">Freestruct handles all the SEO boilerplate so you don't have to. Configure once, and it injects everything.</p>
  
  <div class="features">
    <div class="feature">
      <h3>Open Graph + Twitter Cards</h3>
      <p>Every page gets proper meta tags for social previews. LinkedIn, Twitter, Slack - your docs look good everywhere. Configure your site name and image once, and Freestruct applies it everywhere.</p>
    </div>
    
    <div class="feature">
      <h3>Canonical URLs</h3>
      <p>Proper canonical tags on every page. Search engines index the right URL, not duplicates. Each page gets a canonical pointing to itself with a cache-busting query param.</p>
    </div>
    
    <div class="feature">
      <h3>Cache-busting Hash</h3>
      <p>Each build gets a unique hash injected into the HTML. The hash appears in a meta tag and in asset URLs (CSS, JS, images, fonts). When CDNs see a new URL with a fresh hash, they fetch fresh content. No manual purge needed.</p>
    </div>
    
    <div class="feature">
      <h3>Auto Sitemap</h3>
      <p>Freestruct generates sitemap.xml with all your pages. Search engines can crawl everything without help. The sitemap updates automatically on every build.</p>
    </div>
    
    <div class="feature">
      <h3>Custom Code Hooks</h3>
      <p>Add custom code to every page via hooks. Header, body-start, and footer templates let you inject fonts, analytics, skip links - no template changes needed.</p>
      <p><a href="guides/custom-injection">- Custom Hooks Guide</a></p>
    </div>

    <div class="feature">
      <h3>CDN Purge Hooks</h3>
      <p>Configure CloudFlare, Fastly, or CloudFront to purge automatically after each build. Add a purge command to your config, and Freestruct runs it. Your docs stay fresh.</p>
    </div>
    
    <div class="feature">
      <h3>CDN Purge Hooks</h3>
      <p>Configure CloudFlare, Fastly, or CloudFront to purge automatically after each build. Add a purge command to your config, and Freestruct runs it. Your docs stay fresh.</p>
    </div>
  </div>
  
  <p><a href="configuration">- Full configuration reference</a></p>
</section>

<section class="quickstart">
  <h2>Quick setup</h2>
  
  <p>Install the only dependency, create a config, run Freestruct:</p>
  
  <pre><code>npm install js-yaml

# Create docs/ssr-config.yml with your site info

node docs/lib/inject.js</code></pre>
  
  <p>That's it. See <a href="getting-started">Getting Started</a> for the full guide.</p>
</section>

<section class="why-Freestruct">
  <h2>Why Freestruct?</h2>
  
  <p class="section-intro">Every static doc site needs the same SEO work. Freestruct does it for you automatically - so you can focus on writing docs.</p>
  
  <div class="features">
    <div class="feature">
      <h3>SSG Agnostic</h3>
      <p>Works with whatever SSG you already use. Jekyll, Hugo, Docusaurus, MkDocs, VitePress - Freestruct just needs a folder of HTML files. It doesn't care how the HTML was generated.</p>
    </div>
    
    <div class="feature">
      <h3>Zero Template Changes</h3>
      <p>Don't edit your templates. Don't add plugins to your SSG. Freestruct works on the output files after your SSG is done. Your SSG configuration stays untouched - no lock-in.</p>
    </div>
    
    <div class="feature">
      <h3>Configure Once</h3>
      <p>One config file has your site name, URL, social handles, and image. Apply it to every page automatically. No repeating yourself across every page template.</p>
    </div>
    
    <div class="feature">
      <h3>CI/CD Ready</h3>
      <p>Add Freestruct to your GitHub Actions workflow. It runs after your SSG builds. Every deploy gets SEO automatically - no forgetting to update meta tags, no broken social previews.</p>
    </div>
  </div>
</section>

<section class="concepts">
  <h2>The concept: post-build SEO</h2>
  
  <p class="section-intro">Most SEO tools require template changes or SSG plugins. Freestruct takes a different approach - it runs after your site is built.</p>
  
  <div class="features">
    <div class="feature">
      <h3>Post-build injection</h3>
      <p>Your SSG builds your site as usual. Then Freestruct reads the HTML files and adds meta tags. This means your SSG doesn't need to know about SEO at all - Freestruct handles it separately.</p>
    </div>
    
    <div class="feature">
      <h3>SSG independence</h3>
      <p>Because Freestruct works on the output, it works with any SSG. Switch from Jekyll to Hugo? Just keep running Freestruct - your config stays the same.</p>
    </div>
    
    <div class="feature">
      <h3>Single source of truth</h3>
      <p>Your SEO config lives in one place - ssr-config.yml. Change your site name once, and Freestruct updates every page. No hunting through templates.</p>
    </div>
    
    <div class="feature">
      <h3>Works with CI/CD</h3>
      <p>Since Freestruct runs after your build, it fits naturally into any CI/CD pipeline. GitHub Actions, GitLab CI, Netlify, Vercel - just add one command to your build script.</p>
    </div>
  </div>
</section>

<section class="guides-grid">
  <h2>Guides</h2>
  
  <div class="guides">
    <a href="getting-started" class="guide">
      <h3>Getting Started</h3>
      <p>Full setup in 5 minutes</p>
    </a>
    
    <a href="guides/ssr-config" class="guide">
      <h3>Configuration</h3>
      <p>All available options</p>
    </a>
    
    <a href="guides/cache-busting" class="guide">
      <h3>Cache Busting</h3>
      <p>How the hash works</p>
    </a>

    <a href="guides/custom-injection" class="guide">
      <h3>Custom Hooks</h3>
      <p>Inject any code</p>
    </a>

    <a href="guides/troubleshooting" class="guide">
      <h3>Troubleshooting</h3>
      <p>Common issues</p>
    </a>

    <a href="guides/cicd" class="guide">
      <h3>CI/CD</h3>
      <p>GitHub Actions</p>
    </a>

    <a href="guides/post-render-hooks" class="guide">
      <h3>Post-Render Hooks</h3>
      <p>Beyond SEO</p>
    </a>
  </div>
</section>

<section class="comparison">
  <h2>Freestruct vs manual setup</h2>
  
  <p class="section-intro">Setting up SEO manually works, but you have to do it for every page. Freestruct automates it.</p>
  
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
      <tr>
        <td>Auto sitemap</td>
        <td class="check">Yes</td>
        <td class="x">No</td>
      </tr>
      <tr>
        <td>Search included</td>
        <td class="check">Yes</td>
        <td class="x">No</td>
      </tr>
    </tbody>
  </table>
</section>
