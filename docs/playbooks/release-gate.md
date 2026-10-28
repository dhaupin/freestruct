---
title: Release gate
description: The composed check (battery + docs audit + pack selftest), sync lockstep, and the tarball e2e - the gate a publish rides.
nav_order: 21
permalink: /playbooks/release-gate/
---

# Release gate

Every consumer-facing claim is battery-pinned, so the gate is the proof. Run it before any push; `prepublishOnly` runs the composed `check` on a publish.

```bash
# the composed gate: battery + docs audit + pack selftest
npm run check

# template copies in lockstep (engine -> init -> docs)
npm run sync:check

# tarball e2e: fresh install, quick start through the bin shim
npm run e2e
```

`npm run check` is `npm test && npm run lint:docs && npm run packs:selftest`. `packs:selftest` needs a crashtest checkout: with one present it runs the real teeth, with none present it prints a named skip and exits 0 - CI always installs crashtest, so the teeth run on every push/PR regardless.

Template copies move only via `npm run sync`; CI forbids drift through `npm run sync:check`. Never hand-edit `docs/_freestruct/` or `init/docs/_freestruct/` - edit the canonical `engine/_freestruct/` and sync.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/phone-publish/">Phone publish</a> - the ship-from-download lane.</p>
</div>
