---
permalink: /contributing/style.html
layout: default
title: Voice & Style
nav_order: 21
---
# Voice & Style

Writing guidelines for freestruct content.

## Casing

freestruct uses Title Case for brand references. Use lowercase for CLI commands and code references.

### Rules

- **Title Case**: freestruct (brand name)
- **lowercase**: `freestruct` (CLI, code references, file paths)
- **UPPERCASE**: Acronyms like SEO, API, URL acceptable but prefer Title Case unless defining explicitly

### Examples

| Use | Casing | Example |
|-----|--------|---------|
| Brand name | Title Case | freestruct |
| CLI command | lowercase | `freestruct build` |
| File path | lowercase | `ssr-config.yml` |
| Config option | lowercase | `outputDir`, `site.url` |
| CLI flag | lowercase | `--help`, `--verbose` |
| Acronym | UPPERCASE or Title | SEO or Seo |
| SSG names | Title Case | Jekyll, Hugo, Docusaurus |

### Why

CLI tools use lowercase by convention. Brand names use Title Case. Mixing them correctly signals engineering awareness.

## Our Tone

We're engineers who are also helpful. Clear. Direct. Slightly informal when appropriate, serious when it matters.

We are transparent that AI agents contribute to this project.

## Principles

Our core writing principles.

### 1. Use Short Dashes

Always use `-` instead of `—` or `–`.

| ✓ Right | ✗ Wrong |
|--------|----------|
| "Git is memory - every commit is a checkpoint" | "Git is memory — every commit is a checkpoint" |

### 2. Avoid AI Clichés

These phrases are overused:

| Avoid | Instead |
|-------|---------|
| "delve into" | "explore" |
| "leverage" | "use" |
| "unlock" | use specific |
| "seamless" | remove |
| "empower" | "let you" |
| "journey" | remove |
| "realm" | remove |
| "game-changer" | remove |
| "cutting-edge" | remove |
| "revolutionary" | remove |
| "we're excited to" | remove |

Just say what you mean.

### 3. Be Specific, Not Abstract

| ✗ Abstract | ✓ Specific |
|------------|----------|
| "This feature empowers users to do more" | "This feature generates sitemaps automatically" |
| "freestruct unlocks seamless SEO" | "freestruct injects SEO meta tags post-build" |

### 4. State Facts, Not Hype

| ✗ Hype | ✓ Fact |
|--------|-------|
| "freestruct is a revolutionary SEO system" | "freestruct injects meta tags into static HTML files" |

### 5. Active Voice

Use subject-verb-object. Present tense.

| ✗ Passive | ✓ Active |
|----------|---------|
| "The brain is loaded by the CLI" | "The CLI loads the brain" |

### 6. Code Is Documentation

Show, don't just tell. Include working commands.

### 7. Write for Humans and AIs

- A human should feel respected
- An AI should get clear instructions

## Formatting

| Element | Style |
|---------|-------|
| Headers | Title case (titles), sentence case (subheads) |
| Bullets | Use `-`, not `*` |
| Code | Inline `code` for commands, blocks for examples |
| Links | Descriptive, not "click here" |
| Numbered lists | Use dashes in code blocks (see Code Blocks Need Briefs) |

### Numbered Lists in Code Blocks

Never use numbered lists (`1. 2. 3.`) inside markdown code blocks. Use dashes instead:

```
Steps to run:
- Clone: git clone https://github.com/dhaupin/freestruct.git
- Configure: cp config.example.ini config.ini
```

Why: Markdown parsers may render numbered lists incorrectly inside fenced code blocks.

### Avoid Placeholder Content

Never use "This section covers..." as a section intro. Write actual content:

| ✗ Placeholder | ✓ Real Content |
|--------------|--------------|
| "Track system events for debugging and compliance." | "Track system events for debugging and compliance." |
| "This section covers setup." | "Configure freestruct with your ssr-config.yml." |

### Code Blocks Need Briefs

Every code block needs a 1-sentence explainer before it:

Check system health:

    freestruct health

Why: Readers need context, not just commands.

## Source of Truth

The docs system (`/docs/`) is the source of truth for all documentation.

- README.md references docs, not the other way around
- Keep detailed content in docs
- README provides quick reference with links to full docs

Why: Docs can be rendered with Jekyll (syntax highlighting, navigation, search). README is a single file.

## Focus Areas

**Include:**
- How to use freestruct (clear steps)
- What problems freestruct solves (specific)
- Configuration options (accurate)
- Integration examples (honest)

**Avoid:**
- Vague value propositions
- Over-promising
- Buzzwords

## Example

Show don't vs shouldn't.

### Before (Cliché)

> "Discover the future of SEO with freestruct - the ultimate solution to unlock seamless meta tag injection across your static sites."

### After (Our Style)

> "freestruct injects SEO meta tags into your static HTML after build. No plugins needed."

## Applying This Guide

Check all content for:

- [ ] Em dashes replaced with hyphens
- [ ] Cliché phrases removed
- [ ] Specific over abstract
- [ ] Active voice

## Documenting Sections

Every section header should have a 1-2 sentence intro that answers:

1. **What** is this section about?
2. **Why** does the reader need to know it?

### Example

For example, here's a properly documented section:

    ## Installation
    
    Install freestruct locally or via Docker.
    
    ### Local Install
    For local development:

**What's NOT needed:**
- Long intros (save for index page)
- Multiple paragraphs before first step

## Theme Development

When working on the docs theme:

- Use `{{ 'path' | relative_url }}` for internal paths in layouts (respects baseurl)
- Use relative links without leading slashes in markdown: `href="guides/foo"` not `href="/guides/foo"`
- Favicon should match header brand logo (in both layout and render)
- Index needs h1 from frontmatter title or content

### Template Example

    <a href="{{ '/guides' | relative_url }}">Guides</a>
    <script src="{{ 'pagefind/pagefind.js' | relative_url }}"></script>

See: [_layouts/default.html](/_layouts/default.html), [index.md](/index.html)

## Common Doc Blocks

| Block | Include |
|-------|--------|
| Tables | Headers, 1-2 sentence intro |
| Lists | Lead-in sentence |
| Tips/Notes | Emoji prefix (>, ⚠️) |
| Warnings | Why it matters (1 sentence) |

See also: [Configuration](/configuration.html), [Getting Started](/getting-started.html)