---
title: Phone publish
description: The ship-from-download lane - stage a GitHub zip-extracted tree into the Termux home, install, and publish with the gate riding unchanged.
nav_order: 22
permalink: /playbooks/phone-publish/
---

# Phone publish (the ship-from-download lane)

A GitHub zip carries no `.git` and no `node_modules`, and `/storage/emulated` is a symlinkless FUSE mount where `npm install` dies EACCES creating `node_modules/.bin` symlinks. The lane stages the tree into the Termux home, installs, then publishes with this repo's `prepublishOnly` gate riding unchanged - the script only reaches the launchpad, the gate still rules.

```bash
NPM_TOKEN=npm_xxx node scripts/ship-from-download.cjs \
  --target /storage/emulated/0/Download/freestruct-main/freestruct-main \
  --root ~/web/freestruct-main          # [--dry-run] [--clean]
```

The token rides `NPM_TOKEN` (or `NPM_SHIP_TOKEN`, or `--token-file`), expands from env into a staged one-line `.npmrc` that is unlinked in a finally - it never lands in argv (ps-safe), on disk, or in the log.

Exit contract: `0` ok, `1` child failure (npm's own code surfaces), `2` precondition refusal. Refusals are named (a wrong folder, a non-empty root, a bad token), and the lane never deletes on its own - `--clean` removes only the staged root, on every exit, so a failed run cannot block the retry.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/docs-preview/">Docs preview</a> - build and serve this repo's docs locally.</p>
</div>
