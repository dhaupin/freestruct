---
title: Playbooks
description: The runbook recipes an agent runs against this repo - first run, link triage, the baked-output audit, config validation, the release gate, phone publish and more
nav_order: 16
permalink: /playbooks/
---

# Playbooks

Each playbook is the short series of commands an agent (or a human) runs, in order, with the receipt at every step. They stay inside this repo's contract: config-first (no magic), missing-only injection, escaped-or-fail XML, and the strictness ladder where `--strict` graduates report-only classes to failures.

Every command below is a real command this repo ships. Nothing here promises surface the engine does not do - the [truthfulness gate](/contributing/style) fails on the reverse.

| # | Playbook | The job |
|---|----------|---------|
| 1 | [First run](/playbooks/first-run/) | install, build, inject, verify in four commands |
| 2 | [Link triage](/playbooks/link-triage/) | a `--strict` failure: read the report, fix, re-run |
| 3 | [Baked-output audit](/playbooks/baked-output-audit/) | `freestruct audit` the shipped tree, `--json` for CI |
| 4 | [Config validation](/playbooks/config-validation/) | `validate` before a run, and the version triplet |
| 5 | [Release gate](/playbooks/release-gate/) | the composed check, sync lockstep, tarball e2e |
| 6 | [Phone publish](/playbooks/phone-publish/) | the ship-from-download lane, staged and gated |
| 7 | [Docs preview](/playbooks/docs-preview/) | the rootless Jekyll recipe, served locally |
| 8 | [Pin bump](/playbooks/pin-bump/) | a new prestruct pin: one dependency edit, one verify |

The lanes themselves (what CI runs) live in the [CI/CD guide](/guides/cicd) and [DEPLOY.md](https://github.com/dhaupin/freestruct/blob/main/DEPLOY.md); playbooks are what an agent runs through those lanes.
