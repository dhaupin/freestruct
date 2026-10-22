#!/usr/bin/env node
// scripts/check-language.cjs - language gate (English-only prose).
//
// Ported from dhaupin/vant scripts/check-language.js (issue #184 there),
// adapted to freestruct's tree. Why the gate exists at all: two org agents
// drifted mid-sentence into Chinese from an English conversation on
// 2026-10-11; committed artifacts drift the same way via scripted agents.
// Committed prose a HUMAN reads must be readable by every nationality -
// English is what the OSS landscape runs on.
//
// Contract (same as the vant original):
// 1. SCAN SCOPE: committed files a human reads as prose - docs/, labs/,
//    packs/ (the pack README), plus the root meta set (README / AGENTS /
//    CHANGELOG / CONTRIBUTING / DEPLOY) and any *.md under .github/.
//    Code comments stay OUT of scope (PR-review matter; false positives on
//    identifiers and library names).
// 2. DETECTION is Unicode script-block longest run, not a word blocklist.
//    Han/Hiragana/Katakana/Hangul/Cyrillic/Arabic/Hebrew/Devanagari/Thai/
//    Greek: longest contiguous run per line; flag when the run is
//    >= MIN_RUN (2 can be a transliterated name; 3 reads as writing).
//    Threshold + blocks are DATA at the top - tune in <30 lines.
// 3. ALLOWLIST BY CONSTRUCTION, not intervention: URL-bearing lines,
//    import/export lines, base64-ish blobs, and the
//    LINT_LANGUAGE_ALLOW_RE env regex, so intentional bilingual docs opt
//    out WITHOUT editing the checker.
// 4. FAILURE CONTRACT: exit 1 with `path:line <script-block> (N chars):
//    <trimmed line>`; PASS prints one summary line.
//
// Frontmatter, fenced code blocks, and inline-code spans are literal DATA,
// not prose - exempt (same posture as the docs-style gate).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ---- DATA: tune here -------------------------------------------------
const MIN_RUN = 3;
const SCAN_DIRS = ['docs', 'labs', 'packs'];   // prose trees
const SCAN_GLOBS_DIR = '.github';              // workflows' *.md, any depth
const SCAN_ROOT_META =
    /^(README|AGENTS|CHANGELOG|CONTRIBUTING|DEPLOY|LEGAL|ROADMAP|SECURITY|CODE_OF_CONDUCT).*\.md$/;

// Non-Latin script blocks: (charTest, blockName). Longest run per line.
// Han covers CJK ideographs; Hiragana/Katakana stay separate (Japanese NG
// lines are caught by either).
const CHAR_TESTS = [
    ['Han', /\p{Script=Han}/u],
    ['Hiragana', /\p{Script=Hiragana}/u],
    ['Katakana', /\p{Script=Katakana}/u],
    ['Hangul', /\p{Script=Hangul}/u],
    ['Cyrillic', /\p{Script=Cyrillic}/u],
    ['Arabic', /\p{Script=Arabic}/u],
    ['Hebrew', /\p{Script=Hebrew}/u],
    ['Devanagari', /\p{Script=Devanagari}/u],
    ['Thai', /\p{Script=Thai}/u],
    ['Greek', /\p{Script=Greek}/u],
];

// ---- Allowlist -------------------------------------------------------
function isAllowed(line) {
    if (/https?:\/\//.test(line)) return true;                    // URL-bearing
    if (/^\s*(import|export|require)\b/.test(line)) return true;  // code lines
    if (/[A-Za-z0-9+/]{40,}={0,2}/.test(line)) return true;       // base64-ish
    const env = process.env.LINT_LANGUAGE_ALLOW_RE;
    if (env) {
        try { if (new RegExp(env).test(line)) return true; } catch (e) { /* hostile regex - scan on */ }
    }
    return false;
}

// ---- Scan ---------------------------------------------------------------
const files = [];
for (const dir of SCAN_DIRS) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    (function walk(d) {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, f.name);
            if (f.isDirectory()) walk(p);
            else if (f.name.endsWith('.md')) files.push(p);
        }
    })(base);
}
if (fs.existsSync(path.join(ROOT, SCAN_GLOBS_DIR))) {
    (function walk(d) {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, f.name);
            if (f.isDirectory()) walk(p);
            else if (f.name.endsWith('.md')) files.push(p);
        }
    })(path.join(ROOT, SCAN_GLOBS_DIR));
}
for (const f of fs.readdirSync(ROOT)) {
    if (fs.statSync(path.join(ROOT, f)).isFile() && SCAN_ROOT_META.test(f)) {
        files.push(path.join(ROOT, f));
    }
}
const seen = new Set();
const targets = files.filter((f) => (seen.has(f) ? false : (seen.add(f), true)));

let issues = 0;
const findings = [];
for (const f of targets) {
    const rel = path.relative(ROOT, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let inFence = false;
    // frontmatter is metadata served to a build system, not reader prose
    let inFrontmatter = lines[0] === '---';
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const n = i + 1;
        if (inFrontmatter) {
            if (i !== 0 && /^\s*---\s*$/.test(line)) inFrontmatter = false;
            continue;
        }
        if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        line = line.replace(/`[^`]*`/g, '');    // inline-code is data, not prose
        if (isAllowed(line)) continue;
        for (const [blockName, test] of CHAR_TESTS) {
            let max = 0, cur = 0;
            for (const ch of line) {
                if (test.test(ch)) { cur++; if (cur > max) max = cur; }
                else cur = 0;
            }
            if (max >= MIN_RUN) {
                findings.push(`${rel}:${n} ${blockName} (${max} chars): ${lines[i].trim().slice(0, 100)}`);
                issues++;
            }
        }
    }
}
for (const f of findings) console.log(f);
console.log(issues === 0
    ? `LANGUAGE GATE: PASS (English-only) - ${targets.length} prose files scanned`
    : `LANGUAGE GATE: FAIL (${issues} findings in ${targets.length} prose files)`);
process.exit(issues === 0 ? 0 : 1);
