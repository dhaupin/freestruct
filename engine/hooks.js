// engine/hooks.js - purge hooks + general postBuild hooks (Phase 1.1 split)
// Same security posture as 0.4.x: hooks run only with runHooks: true.

import { execSync } from 'child_process';

// Issue #24: values ride FUNCTION replacers, never string-form replace
// strings. In string form a value carrying $& / $' / $1..9 is treated as
// replacement SYNTAX and corrupts the command that is about to run.
function substitutePlaceholders(command, { siteUrl, buildHash, outputDir }) {
  return command
    .replace(/\$\{?SITE_URL\}?/g, () => siteUrl)
    .replace(/\$\{?BUILD_HASH\}?/g, () => buildHash)
    .replace(/\$\{?OUTPUT_DIR\}?/g, () => outputDir);
}

// Hook children get the same facts as the placeholder substitution, as env
// vars, so a hook script does not have to do string surgery to learn where
// the build landed (issue #21: postBuild consumers chain scripts cleanly).
function hookEnv({ siteUrl, buildHash, outputDir }) {
  return {
    ...process.env,
    FREESTRUCT_SITE_URL: siteUrl,
    FREESTRUCT_BUILD_HASH: buildHash,
    FREESTRUCT_OUTPUT_DIR: outputDir,
  };
}

export function runPurgeHooks(config, buildHash, outputDir) {
  const siteUrl = config.site.url;
  const purgeList = Array.isArray(config.cacheBusting.purge)
    ? config.cacheBusting.purge
    : [config.cacheBusting.purge];

  for (const purge of purgeList) {
    const name = purge.name || 'unnamed';
    let command = typeof purge === 'string' ? purge : purge.command;

    if (!command) {
      console.log('Purge hook ' + name + ': no command configured');
      continue;
    }

    command = substitutePlaceholders(command, { siteUrl, buildHash, outputDir });

    console.log('Purge hook ' + name + ': running...');
    try {
      if (!config.runHooks) {
        console.log('  Command: ' + command.substring(0, 100) + '...');
        console.log('  Purge hooks disabled (set runHooks: true to enable)');
        return;
      }
      execSync(command, { stdio: 'inherit', timeout: 30000 });
      console.log('  Command: ' + command.substring(0, 100) + '...');
      console.log('Purge hook ' + name + ': done');
    } catch (e) {
      console.log('Purge hook ' + name + ': error - ' + e.message);
    }
  }
}

// ---------- general postBuild hooks (issue #21) ----------

// Generalize the already-reviewed purge runner into a first-class seam:
//   hooks:
//     postBuild:
//       - node scripts/whatever.mjs
// Same contract as the purges: nothing executes without runHooks: true,
// execSync carries a timeout, stdio is inherited, the same $-placeholders
// (plus the FREESTRUCT_* env vars) reach the child. Unlike purge hooks, a
// nonzero hook exit is collected and the orchestrator turns the collection
// into a build failure (exit 4 - documented in the CLI contract).
export function runPostBuildHooks(config, buildHash, outputDir) {
  const raw = config.hooks?.postBuild;
  if (raw === undefined || raw === null) return [];
  const commands = Array.isArray(raw) ? raw : [raw];
  if (commands.length === 0) return [];

  const siteUrl = config.site.url;
  const failures = [];
  for (const entry of commands) {
    if (typeof entry !== 'string' || entry === '') {
      console.log('[freestruct] hooks.postBuild entry is not a non-empty string command - skipped');
      continue;
    }
    const command = substitutePlaceholders(entry, { siteUrl, buildHash, outputDir });

    if (!config.runHooks) {
      console.log('PostBuild hook: Command: ' + command.substring(0, 100) + '...');
      console.log('PostBuild hooks disabled (set runHooks: true to enable)');
      return [];
    }

    console.log('PostBuild hook: running ' + command.substring(0, 76) + '...');
    try {
      execSync(command, { stdio: 'inherit', timeout: 30000, env: hookEnv({ siteUrl, buildHash, outputDir }) });
      console.log('PostBuild hook: done');
    } catch (e) {
      console.log('  PostBuild hook: FAILED (exit ' + e.status + ')');
      failures.push(e);
    }
  }
  return failures;
}
