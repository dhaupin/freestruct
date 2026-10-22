---
layout: home
title: freestruct - the post-build SEO layer for static docs
description: Run one command after any SSG builds and every page of your docs carries complete SEO meta, a real sitemap, RSS, a noindex 404, cache-busted assets and validated links. No plugins, no template edits.
nav_order: 0
---

<div class="hero wrap">
    <div class="badge-row">
        <span class="badge"><b>0.9.0</b> &middot; MIT</span>
        <span class="badge">works with <b>any</b> SSG</span>
        <span class="badge">zero SSG plugins</span>
        <span class="badge">one runtime dep</span>
    </div>
    <h1>Your docs deserve real SEO.<br> <em>One command</em> after the build.</h1>
    <p class="sub">freestruct is a post-build layer for static doc sites. Your SSG (Jekyll, Hugo, Docusaurus, MkDocs, VitePress, Astro, Eleventy - any of them) does what it does. Then freestruct reads the built HTML and injects what every page still misses: complete meta, <span style="font-family: ui-monospace, monospace;">sitemap.xml</span> with real per-page dates, <span style="font-family: ui-monospace, monospace;">robots.txt</span>, an RSS feed, a noindex 404, cache-busted assets and validated links.</p>
    <div class="install">
        <span class="p1">{ doc site }$</span>
        <code>npm i -D freestruct &amp;&amp; npx freestruct</code>
    </div>
    <div class="cta-row">
        <a class="btn btn-primary" href="/getting-started">Get started in 5 minutes</a>
        <a class="btn btn-ghost" href="https://github.com/dhaupin/freestruct">Star on GitHub</a>
    </div>

    <div class="pipeline">
        <div class="pipe"><b>Any SSG</b><span>your build, untouched</span></div>
        <div class="pipe"><b>Built tree</b><span>plain HTML files</span></div>
        <div class="pipe hot"><b>freestruct</b><span><code style="font-size:11.5px;">npx freestruct</code> &middot; exit codes 1 / 2 / 3</span></div>
        <div class="pipe"><b>SEO-grade tree</b><span>meta + artifacts fresh on every run</span></div>
    </div>
</div>

<section class="center">
    <div class="wrap">
        <div class="kicker">What lands on every page</div>
        <h2>Deploy a docs site that search engines<br>and link previews finish reading</h2>
        <p class="lede">Everything below is injected missing-only: pages that already carry a tag keep it. Nothing is overwritten, nothing is guessed.</p>

        <div class="gets">
            <div class="get"><h3>Meta + canonical</h3><p>title synthesis, description, a self canonical, and Open Graph, Twitter and JSON-LD blocks - absent tags only.</p></div>
            <div class="get"><h3><code>sitemap.xml</code></h3><p>escaped; one entry per page with a real per-page <code>&lt;lastmod&gt;</code> from the page's own mtime - not a fake build-time stamp.</p></div>
            <div class="get"><h3><code>robots.txt</code></h3><p><code>Allow: /</code> and a sitemap pointer that stays correct under sub-path installs.</p></div>
            <div class="get"><h3>RSS feed</h3><p>escaped titles, per-page <code>pubDate</code>, honest dates - not one build stamp for every item.</p></div>
            <div class="get"><h3>A noindex 404</h3><p>generated when missing, gets full SEO treatment even when you supply your own.</p></div>
            <div class="get"><h3>Cache-busted assets</h3><p>every asset URL gets a per-build hash that CDNs must re-fetch; purge hooks can be wired in for the CDN, opt-in.</p></div>
            <div class="get"><h3>basePath honest URLs</h3><p>canonical, sitemap, feed and 404 links all carry <code>siteurl + basePath</code> exactly once for any sub-path install.</p></div>
            <div class="get"><h3>Link validation</h3><p>internal links checked every run; <code>--strict</code> makes broken ones exit nonzero for your pipeline.</p></div>
            <div class="get"><h3>Nice diagnostics</h3><p>config errors and template or output problems have named exit codes (1 / 2 / 3); <code>--tolerant</code> for soft experiments.</p></div>
        </div>
    </div>
</section>

<div class="any-ssg">
    <div class="wrap">
        <div class="kicker" style="color: var(--accent-soft);">Any generator. No plugins.</div>
        <h2 style="color: var(--ink); font-size: 24px;">Your SSG builds - freestruct finishes</h2>
        <div class="row">
            <span class="ssg">Jekyll</span>
            <span class="ssg">Hugo</span>
            <span class="ssg">Docusaurus</span>
            <span class="ssg">MkDocs</span>
            <span class="ssg">VitePress</span>
            <span class="ssg">Astro</span>
            <span class="ssg">Eleventy</span>
            <span class="ssg">anything HTML</span>
        </div>
    </div>
</div>

<section>
    <div class="wrap">
        <div class="kicker">Quick start</div>
        <h2>Three steps, zero template edits</h2>
        <div class="steps">
            <div class="step">
                <div class="n">1</div>
                <h3>Build like always</h3>
                <p>Your SSG stays untouched. Whatever it emits is the input.</p>
                <pre><span class="c"># jekyll build - or hugo, mkdocs build, ...</span></pre>
            </div>
            <div class="step">
                <div class="n">2</div>
                <h3>Add one config</h3>
                <p>Site name + URL; options are optional. Unknown or retired keys warn, they never die silently.</p>
                <pre><span class="c"># docs/freestruct.config.yml</span>
site:
  name: My Docs
  url: https://example.com/docs</pre>
            </div>
            <div class="step">
                <div class="n">3</div>
                <h3>Run freestruct</h3>
                <p>Config and output dir are discovered automatically; every page and artifact gets finished.</p>
                <pre>npx freestruct</pre>
            </div>
        </div>
    </div>
</section>

<section>
    <div class="wrap">
        <div class="kicker">For agents too</div>
        <h2>Deterministic enough to run unattended</h2>
        <p class="lede">freestruct is agent-hardened and CI-proven. The boring trust facts are pinned by a 41-test battery and run on every push:</p>
        <div class="agents">
            <ul>
                <li><code>exit 0</code> quietly means the tree finished; <code>1 / 2 / 3</code> name exactly which step failed</li>
                <li>fresh-install behavior is proven by <a href="https://github.com/dhaupin/freestruct/blob/main/scripts/e2e-install.cjs">tarball e2e</a>: real pack, real install, real quick start</li>
                <li>an <a href="https://crashtest.creadev.org">adversarial pack</a> attacks our own built docs in CI on every push</li>
                <li>broken-links-as-failures is how our own Pages deploy runs</li>
                <li><code>AGENTS.md</code> at the repo root orients a coding agent in one file</li>
                <li>config semantics are battery-pinned before any doc claims them</li>
            </ul>
        </div>
    </div>
</section>

<section>
    <div class="wrap">
        <div class="kicker">Deep dive</div>
        <h2>Read the contract</h2>
        <p class="lede">The config reference is generated against the schema; every flag promised above exists in code - the docs audit enforces the reverse too.</p>

        <table style="margin-top: 24px; width: 100%; max-width: 720px; border-collapse: collapse; font-size: 13.5px;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); color: var(--ink-soft);">Your job with freestruct</th>
                    <th style="text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); color: var(--ink-soft);">Doing it by hand</th>
                </tr>
            </thead>
            <tbody>
                <tr><td style="padding: 8px 10px; border-bottom: 1px solid var(--line);">Write 4 lines of config once</td><td style="padding: 8px 10px; border-bottom: 1px solid var(--line);">Edit every page template</td></tr>
                <tr><td style="padding: 8px 10px; border-bottom: 1px solid var(--line);">Run one command after build</td><td style="padding: 8px 10px; border-bottom: 1px solid var(--line);">Maintain a plugin per SSG forever</td></tr>
                <tr><td style="padding: 8px 10px; border-bottom: 1px solid var(--line);">Switch SSGs without changing the SEO plan</td><td style="padding: 8px 10px; border-bottom: 1px solid var(--line);">Re-implement meta + sitemap each time</td></tr>
                <tr><td style="padding: 8px 10px;">Trust the CI that attacks its own output</td><td style="padding: 8px 10px;">Hope nothing regresses</td></tr>
            </tbody>
        </table>
    </div>
</section>
