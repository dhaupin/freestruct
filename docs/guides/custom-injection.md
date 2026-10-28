---
title: Custom Injection
description: Add custom code via Freestruct's injection hooks - the template files that auto-load at each slot, how they override the packaged defaults, and how to stage your own
nav_order: 7
---

# Custom Injection

Freestruct supports custom injection hooks - template files in `docs/_freestruct/` are auto-loaded if they exist (they win over the packaged `engine/_freestruct/` templates; see the init kit to stage them).

> **Note:** Location is `_freestruct/` (not `_includes/`) to avoid collisions with Jekyll and other SSGs.

## Hooks

| File | Injected |
|------|----------|
| `inject-header.html` | Before `</head>` |
| `inject-body-start.html` | After `<body>` |
| `inject-footer.html` | Before `</body>` |

## Placeholders

All hooks substitute the same placeholder set the head template uses - the full list is in the [Freestruct.config Reference](/guides/freestruct-config) under Template Placeholders. The three you reach for most:

- `{{siteName}}` - Site name from config
- `{{siteUrl}}` - Site URL from config
- `{{buildHash}}` - Current build hash

`{{buildHash}}` is safe in head snippets (the injector strips the generated head region before deriving the next hash), but do not embed it in a body or footer snippet: the hash is derived from page content, so an embedded hash would make every following build depend on its own previous value.

## Examples

### Add custom fonts (inject-header.html)

```html
<link rel="stylesheet" href="{{siteUrl}}/fonts/inter.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
```

### Add skip link (inject-body-start.html)

```html
<a href="#main" class="skip-link">Skip to content</a>
```

### Add analytics (inject-footer.html)

```html
<script defer src="{{siteUrl}}/js/analytics.js"></script>
```

## How it works

1. Create or edit the template file in `docs/_freestruct/`
2. Run your SSG build
3. Run `npx freestruct [output]`
4. Check the output HTML

The files are loaded only if they exist - no config needed.

## Related

- [Template](/guides/template) - Frontmatter and page conventions
- [Cache Busting](/guides/cache-busting) - Understanding the hash
- [Post-Render Hooks](/guides/post-render-hooks) - Beyond SEO
- [Freestruct.config Reference](/guides/freestruct-config) - Configuration reference
