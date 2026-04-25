
---
title: Custom Injection
description: Add custom code via injection hooks
---

# Custom Injection

freestruct supports custom injection hooks - create template files in `docs/_includes/` and they'll be auto-loaded if they exist.

## Hooks

| File | Injected |
|------|----------|
| `inject-header.html` | Before `</head>` |
| `inject-body-start.html` | After `<body>` |
| `inject-footer.html` | Before `</body>` |

## Placeholders

All hooks support these placeholders:

- `{{siteName}}` - Site name from config
- `{{siteUrl}}` - Site URL from config
- `{{buildHash}}` - Current build hash

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

1. Create or edit the template file in `docs/_includes/`
2. Run your SSG build
3. Run `node docs/lib/inject.js [output]`
4. Check the output HTML

The files are loaded only if they exist - no config needed.
