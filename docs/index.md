---
layout: home
title: freestruct
description: Frame-agnostic SEO layer for static doc sites. Configure once, inject everywhere.
---

<div class="hero">
  <div class="hero-badge">v0.2.0 Released</div>
  <h1>Your docs deserve to be <em>seen</em></h1>
  <p class="hero-sub">SEO injection for any static site generator. No plugins. No template editing. Just works.</p>
  
  <div class="hero-actions">
    <a href="/getting-started" class="btn btn-primary">Get Started →</a>
    <a href="#how-it-works" class="btn btn-secondary">See How It Works</a>
  </div>
  
  <div class="hero-demo">
    <div class="code-window">
      <div class="code-header">
        <span class="dot red"></span>
        <span class="dot yellow"></span>
        <span class="dot green"></span>
      </div>
      <pre><code><span class="code-comment"># 1. Build your docs (any SSG)</span>
jekyll build

<span class="code-comment"># 2. Run freestruct</span>
node docs/lib/inject.js

<span class="code-comment"># Done. Every page now has:</span>
<span class="code-comment"># → Open Graph tags</span>
<span class="code-comment"># → Twitter Cards</span>
<span class="code-comment"># → Canonical URLs</span>
<span class="code-comment"># → JSON-LD Schema</span>
<span class="code-comment"># → Cache-busting hash</span></code></pre>
    </div>
  </div>
</div>

<div class="pain-section" id="why">
  <h2>The "Why Isn't My Docs Updating" Problem</h2>
  <p class="pain-lead">You deployed. Users see old content. You verified the build. You checked the deploy. But something is broken. Again.</p>
  
  <div class="pain-grid">
    <div class="pain-card">
      <div class="pain-icon">📦</div>
      <h3>CDN Cache</h3>
      <p>CloudFlare, Fastly, CloudFront cache your HTML. Deploy doesn't clear it.</p>
    </div>
    <div class="pain-card">
      <div class="pain-icon">🔄</div>
      <h3>Browser Cache</h3>
      <p>Users have local copies. Hard refresh doesn't work. They blame you.</p>
    </div>
    <div class="pain-card">
      <div class="pain-icon">🕐</div>
      <h3>Legacy SSG</h3>
      <p>Your Jekyll/Hugo version is ancient. Can't upgrade. Can't fix.</p>
    </div>
    <div class="pain-card">
      <div class="pain-icon">🐢</div>
      <h3>No Server Access</h3>
      <p>GitHub Pages, Netlify basic tier. Can't set cache headers. Stuck.</p>
    </div>
  </div>
  
  <p class="pain-solution">freestruct fixes this. Every build generates a unique hash. CDNs see new content. Users see fresh docs. No manual purge. No stress.</p>
</div>

<div class="features-section" id="features">
  <h2>Everything You Need, Nothing You Don't</h2>
  
  <div class="feature-row">
    <div class="feature-icon">🎯</div>
    <div class="feature-content">
      <h3>Frame-Agnostic</h3>
      <p>Jekyll? Hugo? Docusaurus? MkDocs? VuePress? Astro? It doesn't matter. freestruct works with <strong>any</strong> static site generator. Point it at your output folder, done.</p>
    </div>
  </div>
  
  <div class="feature-row">
    <div class="feature-icon">⚡</div>
    <div class="feature-content">
      <h3>Zero Config, Maximum Results</h3>
      <p>One YAML file. Your site name, URL, social handles. That's it. freestruct injects all your SEO meta, OG tags, Twitter cards, and JSON-LD schema into every page automatically.</p>
    </div>
  </div>
  
  <div class="feature-row">
    <div class="feature-icon">🛡️</div>
    <div class="feature-content">
      <h3>Cache Busting Built-In</h3>
      <p>Every build gets a unique SHA1 hash. Injected into a meta tag and canonical URL. CDNs must fetch fresh content. Browser cache bypassed. Deploy with confidence.</p>
    </div>
  </div>
  
  <div class="feature-row">
    <div class="feature-icon">🔌</div>
    <div class="feature-content">
      <h3>CDN Purge Hooks</h3>
      <p>Configure purging for CloudFlare, Fastly, CloudFront, or anything else. freestruct runs your custom shell commands with env vars after every build. Automate the pain away.</p>
    </div>
  </div>
  
  <div class="feature-row">
    <div class="feature-icon">🔍</div>
    <div class="feature-content">
      <h3>Sitemap Auto-Generated</h3>
      <p>freestruct creates a proper sitemap.xml with all your pages. Search engines will thank you. No extra plugins needed.</p>
    </div>
  </div>
  
  <div class="feature-row">
    <div class="feature-icon">🚀</div>
    <div class="feature-content">
      <h3>GitHub Actions Ready</h3>
      <p>Works perfectly with CI/CD. Add two lines to your workflow. Every commit deploys with perfect SEO. No maintenance required.</p>
    </div>
  </div>
</div>

<div class="compare-section">
  <h2>vs. The Old Ways</h2>
  
  <div class="compare-table">
    <div class="compare-header">
      <div></div>
      <div>freestruct</div>
      <div>Manual SEO</div>
      <div>SSG Plugins</div>
    </div>
    <div class="compare-row">
      <div class="compare-label">Works with any SSG</div>
      <div class="compare-check">✓</div>
      <div class="compare-check">✓</div>
      <div class="compare-x">✗</div>
    </div>
    <div class="compare-row">
      <div class="compare-label">One-time config</div>
      <div class="compare-check">✓</div>
      <div class="compare-x">✗</div>
      <div class="compare-check">✓</div>
    </div>
    <div class="compare-row">
      <div class="compare-label">Cache busting</div>
      <div class="compare-check">✓</div>
      <div class="compare-x">✗</div>
      <div class="compare-dash">~</div>
    </div>
    <div class="compare-row">
      <div class="compare-label">No template changes</div>
      <div class="compare-check">✓</div>
      <div class="compare-x">✗</div>
      <div class="compare-x">✗</div>
    </div>
    <div class="compare-row">
      <div class="compare-label">CDN purge hooks</div>
      <div class="compare-check">✓</div>
      <div class="compare-x">✗</div>
      <div class="compare-dash">~</div>
    </div>
  </div>
</div>

<div class="cta-section">
  <h2>Ready to fix your docs?</h2>
  <p>5 minutes to set up. Years of peace of mind.</p>
  <a href="/getting-started" class="btn btn-primary btn-large">Get Started Now →</a>
  <p class="cta-note">Free. Open source. No dependencies.</p>
</div>

<style>
.hero {
  text-align: center;
  padding: 3rem 1rem;
}

.hero-badge {
  display: inline-block;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 0.375rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.hero h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.hero h1 em {
  color: #2563eb;
  font-style: normal;
}

.hero-sub {
  font-size: 1.25rem;
  color: #6b7280;
  max-width: 600px;
  margin: 0 auto 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 3rem;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.code-window {
  background: #1f2937;
  border-radius: 0.75rem;
  max-width: 500px;
  margin: 0 auto;
  overflow: hidden;
}

.code-header {
  background: #374151;
  padding: 0.75rem 1rem;
  display: flex;
  gap: 0.5rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red { background: #ef4444; }
.dot.yellow { background: #f59e0b; }
.dot.green { background: #10b981; }

.code-window pre {
  margin: 0;
  padding: 1.5rem;
  text-align: left;
  overflow-x: auto;
}

.code-window code {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 0.875rem;
  color: #e5e7eb;
  line-height: 1.7;
}

.code-comment {
  color: #6b7280;
}

.pain-section {
  padding: 4rem 1rem;
  background: #f9fafb;
  text-align: center;
}

.pain-section h2 {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.pain-lead {
  font-size: 1.125rem;
  color: #6b7280;
  max-width: 600px;
  margin: 0 auto 2rem;
}

.pain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  max-width: 1000px;
  margin: 0 auto 2rem;
}

.pain-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  text-align: left;
}

.pain-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.pain-card h3 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.pain-card p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.pain-solution {
  font-size: 1.125rem;
  color: #059669;
  font-weight: 600;
  max-width: 600px;
  margin: 0 auto;
}

.features-section {
  padding: 4rem 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.features-section h2 {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 3rem;
}

.feature-row {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  align-items: flex-start;
}

.feature-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.feature-content h3 {
  font-size: 1.125rem;
  margin: 0 0 0.5rem;
}

.feature-content p {
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

.compare-section {
  padding: 4rem 1rem;
  background: #f9fafb;
}

.compare-section h2 {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 2rem;
}

.compare-table {
  max-width: 700px;
  margin: 0 auto;
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.compare-header, .compare-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  align-items: center;
}

.compare-header {
  background: #f3f4f6;
  font-weight: 600;
  font-size: 0.875rem;
}

.compare-header div:not(:first-child) {
  text-align: center;
}

.compare-row {
  border-top: 1px solid #e5e7eb;
}

.compare-label {
  font-size: 0.875rem;
}

.compare-check {
  text-align: center;
  color: #10b981;
  font-weight: bold;
}

.compare-x {
  text-align: center;
  color: #ef4444;
}

.compare-dash {
  text-align: center;
  color: #9ca3af;
}

.cta-section {
  padding: 4rem 1rem;
  text-align: center;
}

.cta-section h2 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.cta-section p {
  color: #6b7280;
  margin-bottom: 2rem;
}

.cta-note {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-top: 1rem;
}

@media (max-width: 640px) {
  .hero h1 {
    font-size: 2rem;
  }
  
  .compare-table {
    font-size: 0.75rem;
  }
  
  .compare-header, .compare-row {
    padding: 0.75rem 0.5rem;
    gap: 0.5rem;
  }
}
</style>
