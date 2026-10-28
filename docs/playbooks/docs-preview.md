---
title: Docs preview
description: Build and serve this repo's Jekyll docs locally with the rootless recipe - a scratch copy, a strict run, a local server.
nav_order: 23
permalink: /playbooks/docs-preview/
---

# Docs preview (the rootless Jekyll recipe)

CI is the real verifier for anything Jekyll-shaped, but a local build gives a
faster strict-lint loop than waiting on a push. This sandbox has no root and no
system Ruby, so the recipe uses a prebuilt, platform-matched toolchain under
`$HOME` and never touches the repo. The full recipe (the ruby-builder download,
the binstub shims, the `LD_LIBRARY_PATH` / `RUBYLIB` exports) is recorded in
[DEPLOY.md](https://github.com/dhaupin/freestruct/blob/main/DEPLOY.md); the
short form:

```bash
# 1. prebuilt Ruby into $HOME (never the repo), then shim the binstubs
mkdir -p ~/rubies && cd ~/rubies
curl -sL -o ruby.tar.gz \
  https://github.com/ruby/ruby-builder/releases/download/ruby-3.4.12/ruby-3.4.12-ubuntu-24.04-x64.tar.gz
tar xzf ruby.tar.gz
for t in bundle gem rake jekyll; do
  printf '#!/bin/sh\nexec "$HOME/rubies/x64/bin/ruby" "$HOME/rubies/x64/bin/%s" "$@"\n' "$t" \
    > ~/rubies/shims/$t; chmod +x ~/rubies/shims/$t; done

# 2. build from a scratch COPY so Jekyll's _site never taints the tree
rm -rf /tmp/fspreview && mkdir -p /tmp/fspreview && cp -r docs /tmp/fspreview/docs
rm -rf /tmp/fspreview/docs/_site
cd /tmp/fspreview/docs && bundle install && bundle exec jekyll build

# 3. strict run from the scratch root (config walk-up finds the config)
cd /tmp/fspreview && node /workspace/project/freestruct/bin/freestruct.mjs --strict

# 4. serve the baked tree locally
cd /tmp/fspreview/docs/_site && python3 -m http.server 12000
```

The scratch-copy step is the point: Jekyll writes `_site` beside its source,
so building in a copy carries every build product away from the repo. The
`.gitignore` block (`docs/.bundle/`, `docs/vendor/`, `docs/_site/`,
`docs/.jekyll-cache/`) is belt-and-suspenders on top of that.

Receipt: `labs/receipts/docs-preview-dark.png` and `docs-preview-light.png` -
the same CLI guide page in both themes, code fences painted by the rouge token
block.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/pin-bump/">Pin bump</a> - taking a new upstream pin.</p>
</div>
