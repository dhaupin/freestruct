---
layout: home
title: freestruct
description: Frame-agnostic SEO layer for static doc sites. Configure once, inject everywhere.
---

<div class="how-it-works" id="how-it-works">
  <h2>Three steps to perfect SEO</h2>
  
  <div class="steps">
    <div class="step">
      <div class="step-number">1</div>
      <div class="step-content">
        <h3>Build your docs</h3>
        <p>Use any SSG: Jekyll, Hugo, Docusaurus, MkDocs, VitePress</p>
        <code class="step-code">jekyll build</code>
      </div>
    </div>
    
    <div class="step">
      <div class="step-number">2</div>
      <div class="step-content">
        <h3>Run freestruct</h3>
        <p>One command injects everything</p>
        <code class="step-code">node docs/lib/inject.js</code>
      </div>
    </div>
    
    <div class="step">
      <div class="step-number">3</div>
      <div class="step-content">
        <h3>Deploy with confidence</h3>
        <p>Every page has OG tags, Twitter cards, sitemap, and cache-busting built in</p>
      </div>
    </div>
  </div>
</div>

<div class="pain-section" id="why">
  <h2>The "Why Isn't My Docs Updating" Problem</h2>
  <p class="pain-lead">You deployed. Users see old content. You verified the build. But something is broken. Again.</p>
  
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
  
  <p class="pain-solution">
    <a href="/guides/cache-busting">→ Learn how freestruct fixes this</a>
  </p>
</div>

<div class="features-section" id="features">
  <h2>Everything included</h2>
  
  <div class="feature-grid">
    <div class="feature-card">
      <div class="feature-icon">🔍</div>
      <h3>Search Integration</h3>
      <p>PageFind baked in with ⌘K shortcut. Auto-indexed post-build.</p>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">📱</div>
      <h3>Open Graph + Twitter</h3>
      <p>Meta tags that make your docs look great on social and search results.</p>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">🗺️</div>
      <h3>Sitemap + Robots</h3>
      <p>Auto-generated sitemap.xml with all your pages. Search engines find everything.</p>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">🛡️</div>
      <h3>Cache Busting</h3>
      <p>Every build gets a unique hash. CDNs see fresh content. No manual purge.</p>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">🔌</div>
      <h3>CDN Purge Hooks</h3>
      <p>Run CloudFlare, Fastly, CloudFront purge commands automatically.</p>
    </div>
    
    <div class="feature-card">
      <div class="feature-icon">🚀</div>
      <h3>Post-Render Hooks</h3>
      <p>Modify HTML at build time: fix links, add banners, inject A/B tests.</p>
    </div>
  </div>
  
  <p class="features-link">
    <a href="/configuration">→ Full configuration reference</a>
  </p>
</div>

<div class="guides-section" id="guides">
  <h2>Quick links</h2>
  
  <div class="guides-grid">
    <a href="/getting-started" class="guide-card">
      <h3>Getting Started</h3>
      <p>Up and running in 5 minutes</p>
    </a>
    
    <a href="/guides/ssr-config" class="guide-card">
      <h3>ssr-config.yml</h3>
      <p>All available options</p>
    </a>
    
    <a href="/guides/cache-busting" class="guide-card">
      <h3>Cache Busting</h3>
      <p>Why the hash matters</p>
    </a>
    
    <a href="/guides/cache-busting-faq" class="guide-card">
      <h3>Cache Busting FAQ</h3>
      <p>Every edge case explained</p>
    </a>
    
    <a href="/guides/post-render-hooks" class="guide-card">
      <h3>Post-Render Hooks</h3>
      <p>Beyond SEO: HTML processing</p>
    </a>
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
  <p class="cta-note">Free. Open source. Zero runtime dependencies.</p>
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
  margin-bottom: 2rem;
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

/* How it works */
.how-it-works {
  padding: 4rem 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.how-it-works h2 {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 3rem;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.step {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.step-number {
  width: 3rem;
  height: 3rem;
  background: #2563eb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content h3 {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
}

.step-content p {
  color: #6b7280;
  margin: 0 0 0.75rem;
}

.step-code {
  display: inline-block;
  background: #1f2937;
  color: #10b981;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 0.875rem;
}

/* Pain section */
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
}

.pain-solution a {
  color: #059669;
  font-weight: 600;
  text-decoration: none;
}

.pain-solution a:hover {
  text-decoration: underline;
}

/* Features */
.features-section {
  padding: 4rem 1rem;
  max-width: 900px;
  margin: 0 auto;
}

.features-section h2 {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 2rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
}

.feature-card .feature-icon {
  font-size: 1.75rem;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}

.feature-card p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.features-link {
  text-align: center;
  margin-top: 2rem;
}

.features-link a {
  color: #2563eb;
  font-weight: 500;
}

/* Guides */
.guides-section {
  padding: 4rem 1rem;
  background: #f9fafb;
}

.guides-section h2 {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 2rem;
}

.guides-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.guide-card {
  background: white;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}

.guide-card:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.guide-card h3 {
  font-size: 1rem;
  margin: 0 0 0.25rem;
  color: #1f2937;
}

.guide-card p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

/* Compare */
.compare-section {
  padding: 4rem 1rem;
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

/* CTA */
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

/* Responsive */
@media (max-width: 640px) {
  .hero h1 {
    font-size: 2rem;
  }
  
  .step {
    flex-direction: column;
    align-items: center;
    text-align: center;
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
