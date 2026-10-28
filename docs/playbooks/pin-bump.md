---
title: Pin bump
description: Bumping a pinned dependency - the workflow edit, the cache-key follow-on, and the verify step.
nav_order: 24
permalink: /playbooks/pin-bump/
---

# Pin bump

This repo pins the tools its lanes run so a lane cannot drift under it: the
crashtest gate sha and the pagefind version in `docs.yml`, ruby `3.4`, and the
action versions across the workflows. A bump is a small, deliberate edit - one
pin, one cache key, one verify.

```bash
# 1. edit the pin (example: the crashtest gate sha in docs.yml)
edit .github/workflows/docs.yml   # crashtest-<old-sha> -> crashtest-<new-sha>

# 2. bump the matching CACHE KEY in the same commit
#    (a stale key ships the old binary on a cache hit - the #29 straggler class)

# 3. verify locally: the pin only proves itself when the lane runs
npm run check && npm run sync:check && npm run e2e
```

Two rules the pins taught us:

- **A pin and its cache key move together.** The crashtest installer cache and
  the pagefind indexer cache are both keyed on the pinned value; bumping the
  version without the key ships the old artifact to every warm runner.
- **One number, everywhere.** The crashtest sha appears in the install step,
  the cache key, and the cache-restore step. Change all three or the lane
  reads two different gates.

A pin bump never changes engine source - it changes what the lane runs. If the
new pin exposes a real failure, that is a separate fix with its own battery
pin, not a reason to revert the pin.

<div class="playbook-next">
<p><strong>Back to:</strong> <a href="/playbooks/">all playbooks</a>.</p>
</div>
