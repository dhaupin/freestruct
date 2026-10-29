---
version: 1.2.0
permalink: /discussions/announcing-freestruct-v1.2.0/
# Family release-post shape (the crashtest docs precedent): layout default
# renders the post in the normal frame, and the trailing-slash permalink
# lands the artifact as dir/index.html - an extensionless fragment would be
# served by Pages as application/octet-stream: never injected, absent from
# sitemap/feed/llms.
layout: default
title: "Announcing freestruct v1.2.0"
description: The v1.2.0 Discussions release post, per the Creadev family release-post convention
---

# freestruct v1.2.0

freestruct is a post-build SEO layer for static doc sites. v1.2.0 is everything since the v1.1.0 tag: the family sweep and the docs/tooling wave that followed it, then a hardening pass that walked the engine corners the queue-era waves never probed. With the issue queue fully closed (#1-#40), nine real fixes landed, each with a battery pin, plus the issue #41 version-truth census leg. No new config surface - just fewer quiet mistakes. This post ships with the v1.2.0 tag:

```bash
npm i -D freestruct
```

## What landed

**The family sweep and docs wave (post-tag).** The link checker now resolves root-absolute hrefs against the configured `basePath`, so a baseurl'd site's nav passes `--strict`; config-gated audit absences (`og:image`, `twitter:image`) collapse to one line with an affected-page count; and the release gate is composed - `npm run check` (battery + docs audit + pack selftest) runs from `prepublishOnly`. The init kit seeds the family JSON-LD identity, the Pages runbook is promoted to a reusable `workflow_call` lane, every `actions/cache` step pins one major, and a new playbooks leg puts the runbook recipes next to the gates they prove. The 72-column commit-time habit is retired: living prose flows, and `scripts/unwrap-prose.cjs` keeps it that way.

**The engine sweep.** The custom body-start and footer snippets (`inject-body-start.html`, `inject-footer.html`) were appended raw on every pass with nothing marking them as freestruct's own, so a second run stacked a duplicate copy - and because the body text then differed, it churned the content-derived `freestruct-build` hash on every run, defeating the deterministic-hash contract that keeps CDN caches honest. The snippets are now marker-wrapped, the injector strips the previous copy before re-adding it, and the hash computation ignores the same region, so run 1, run 2 and run 3 are byte-identical.

**The minifier respects verbatim blocks.** `minifyHtml` only recognized bare `<pre>`/`<script>`/`<style>`/`<textarea>` open tags, so a fence like `<pre class="highlight">` was not treated as a block at all: its indentation collapsed and, worse, inline JavaScript carrying a `//` comment flattened onto a single line - commenting out the rest of the script. The pass is now verbatim-block aware (attribute forms included): block content survives byte-for-byte while whitespace outside blocks still collapses.

**Two matching bugs in the head pipeline.** Cache busting tested asset extensions with a substring match, so `/x.cs` (`.cs` lives inside `.css`), `/x.tt` and `/x.j` all picked up a bogus `?v=` while a genuine `/img.PNG` was missed entirely (the test was case-sensitive). It is now a case-insensitive extension set. And the link checker only matched double-quoted `href="..."`, so a single-quoted broken link (`href='/gone/'`, perfectly valid HTML) sailed through `--strict`; both quote styles are checked now.

**The documented env actually reaches hooks.** `README` and the hooks guide both promise `FREESTRUCT_SITE_URL`, `FREESTRUCT_BUILD_HASH` and `FREESTRUCT_OUTPUT_DIR` on hook children, but the purge-hook runner called its child without them - only `hooks.postBuild` passed them through. Both seams pass the same env now.

**Three smaller repairs.** Self-closing images no longer get a malformed lazy-load attribute (`<img ... />` used to become `<img ... / loading="lazy">`). The audit's meta grabber tolerates a leading attribute, so a valid `<meta charset="utf-8" name="description" ...>` is no longer a false "missing meta description" failure. And the audit's on-disk image check normalizes a `basePath` that lacks its leading slash, so a present image stops warning as missing on sub-path installs.

**A CLI edge.** `-h` was listed as a known flag but never handled, so it rode as the positional output directory and the run died with `Output directory not found: .../-h`. It now aliases `--help`.

## Quality layer

The fixture battery grew from 121 pins to 130, one red-checked pin per fix, and the issue #41 version-truth census leg added two more (130 -> 132), with the issue #43 count census adding a third (132 -> 133), the post-merge staging pass a fourth (133 -> 134), the repo-wide gap walk twenty-six more (134 -> 160), and the prestruct port pass two more (160 -> 162): it derives the version from `package.json` and refuses every living surface that hand-copied the current one - the README current-release line, the AGENTS/CONTRIBUTING/DEPLOY pins, the pass-log reminder, the `release.yml` tag example, and the `init/VERSION` stamp - while range pins, dated era rows and other packages' versions stay out of scope by design. The sweep hunted the surfaces the earlier queue-era waves had left untouched: the minifier, the cache-bust matcher, the link checker, the purge-hook runner, the lazy-load pass, and two audit helpers, plus the CLI flag table. The gap walk then closed the entity path end to end: the page-fact extractors are now attribute-order and quote tolerant and decode HTML entities, so a reordered meta is read, the feed escapes exactly once (`&amp;`, never `&amp;amp;`), and search.json carries plain text; the minifier no longer fuses words across a line break; cache busting reaches single-quoted assets; and an audit path that escapes the output tree is named rather than probed. A second walk followed: the internal-link checker strips a query string before resolving (so a utm-tagged nav link no longer fails `--strict`), cache busting reads the asset extension off the path (so an asset with an existing query or fragment is busted too) and masks code examples and script bodies (so a link SHOWN in a docs page is not rewritten), and a disabled hook config reports every configured hook rather than only the first. A third probe caught the table wrapper churning the content-derived hash on every rerun (the wrapper lands after the hash is computed), so the stable view now strips it and a table site stays idempotent; the same pass found search.json shipping raw script/style bodies and h1 markup into the index, now plain text, and a 404 page interpolating the raw site name unescaped, now escaped like every other injected value, and the reading-time meta counting script/style/comment text as prose, now sharing one htmlToText view with the search index, and the indexnow subcommand posting XML-escaped sitemap URLs, now decoded before submission, llms.txt emitting raw markdown link labels, now escaped so a bracketed title cannot break the link, and the shared entity decoder mapping only five named entities, so a typographic title double-escaped into the feed - now resolving decimal, hex and the common named set with the audit length graders measuring decoded text, the indexnow keyLocation ignoring basePath so a sub-path install probed the domain root, a site-local og:image joining onto site.url alone so the share card 404d under the same prefix, both now following the pageUrlFor contract, and two HTML-attribute regexes that alone among their families lacked the case-insensitive flag, so an upper-case description meta drew a duplicate the audit then failed and an upper-case HREF shipped a broken link green under --strict, a lazy-load guard that ignored a caps or whitespace-padded loading attribute and appended a duplicate, a 404 noindex the pipeline wrote before the injection pass so a rerun's hygiene strip deleted it - the build passed once, then failed its own audit on the second run, now asserted past the strip, and feed pubDate/sitemap lastmod that read freestruct's own rewrite back as the page date on the second run and re-stamped the whole feed on every redeploy, now pinned to the pre-injection mtime. The final pass turned to CI itself: it verified main only, so staging work went unverified until promotion and the Pages deploy carried no ref guard - test.yml and docs.yml now cover staging on push and pull request, the reusable docs lane gates its deploy job to main so no caller can publish staging by accident, and every promotion fast-forwards staging to main so a merge-commit promotion cannot leave the integration branch a commit behind. Every fix was reproduced first (a failing pin or an offline probe), then corrected, then re-pinned. CI runs the full gate set on every push and pull request - the battery, the seven-gate docs audit, template sync lockstep, the tarball e2e, the crashtest pack selftest, and a live docs deploy that dogfoods freestruct against its own freshly built site.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
