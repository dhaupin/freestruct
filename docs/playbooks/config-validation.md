---
title: Config validation
description: Validate freestruct.config.yml before a run, and keep the version triplet honest.
nav_order: 20
permalink: /playbooks/config-validation/
---

# Config validation

`validate` loads and checks the config without touching any output tree. Exit
1 on fatal errors, so it fits a pre-build CI step.

```bash
# load + validate; no output tree is touched
npx freestruct validate

# print the shipped version (works configless)
npx freestruct --version
```

The config contract is config-first and no-magic: unknown or retired keys warn
loudly rather than silently no-op. Retired keys (for example
`preserveExistingMeta`) produce a named warning; a fatal schema error exits
non-zero.

The version is one number across the whole repo. The battery's version-truth
pin refuses any `README.md` / `package.json` / `CHANGELOG.md` triplet that
disagrees, and `init/VERSION` rides the same number. A bump is one edit in
those places plus the pin keeps them honest.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/release-gate/">Release gate</a> - the composed check before a publish.</p>
</div>
