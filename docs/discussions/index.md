---
permalink: /discussions
layout: default
title: Release Posts
description: The release-post system - one announcing-freestruct-vX.Y.Z.md per release, the file is the announcement, lint-gated like every other docs surface.
nav_order: 21
---

# Release posts

One post per release, shaped like crashtest's [release-post system](https://github.com/dhaupin/crashtest/blob/main/docs/discussions/announcing-v1.1.0.md). The post lives in `docs/discussions/` as versioned source so the release trail sits in the same tree as the changelog it summarizes, and the file's raw markdown is the GitHub Discussions announcement - view source, copy, strip the frontmatter, post.

## The conventions

- **One file per release, named after it.** `announcing-freestruct-vX.Y.Z.md`, matching the npm version on the day the post is drafted. Never reuse a filename; fold a retry's delta into the same post instead.
- **Frontmatter contract.** `permalink`, `layout`, `title`, `description`, plus a `version` key.
- **Trailing-slash permalinks, always.** Every permalink in this folder ends with a `/`: an extensionless one makes Jekyll emit a headless fragment that GitHub Pages serves as `application/octet-stream`, and nothing in the freestruct pipeline (injection, sitemap, feed, llms) ever touches it. The slash is what lands the artifact as `dir/index.html` - a real page.
- **The file is the post.** Below the frontmatter the file carries the announcement body itself; the source of the doc is the source of the post.
- **Timing.** Draft the post against the released version, not the dev tree - a post implying a version is on npm when the tag is not cut is fiction by promotion. (The v1.2.0 row below stays tag-pending until the tag lands.)
- **Gates.** `npm run lint:docs` runs on these files like everywhere else - fence language tags, heading levels, table shape, the dash and cliche scans, the docs link checker.

## The index

| post | version | live |
| --- | --- | --- |
| [Announcing freestruct v1.2.0](/discussions/announcing-freestruct-v1.2.0/) | 1.2.0 | tag pending |
| [Announcing freestruct v1.1.0](/discussions/announcing-freestruct-v1.1.0/) | 1.1.0 | 2026-10-25 on npm |
| [Announcing freestruct v1.0.0](/discussions/announcing-freestruct-v1.0.0/) | 1.0.0 | 2026-10-22 on npm |

History: prestruct and crashtest carry the same shape, so approaches to the community discussions stay uniform across the Creadev family ([crashtest's release-post index](https://github.com/dhaupin/crashtest/tree/main/docs/discussions) is the current reference for this page).
