// engine/hostpolicy.js - the SSRF guard for the opt-in external link pass.
//
// `freestruct audit --external` fetches the URLs a BAKED tree names, and a
// baked tree can be attacker-influenced (a CMS field, a scraped page, a
// dependency's demo HTML). Left open, that pass is a server-side request
// forgery primitive: a link to `http://169.254.169.254/...` (cloud metadata),
// `http://127.0.0.1:<port>/` (a co-located service), or an internal
// `http://10.0.0.5/` makes the run probe a host the tree's author cannot reach
// directly and report the status in the findings. This module closes that: a
// host LITERAL that names a private, loopback, link-local, unique-local, or
// otherwise non-public address is REFUSED before any socket opens (a
// network-free, deterministic call).
//
// The check is on the host LITERAL, in every spelling a parser accepts
// (dotted-quad, bare integer, octal, hex, short forms, IPv6, IPv4-mapped
// IPv6, and the explicit-root trailing dot). A public name that DNS-rebinds to
// a private address is a separate class (TOCTOU at resolution time) that a
// literal check cannot see and that pinning the resolved IP would be needed to
// close - noted honestly, not silently claimed.
//
// This is the family shape poststruct's external lane carries (dhaupin/
// poststruct src/checks/external.mjs), ported here because freestruct's
// external pass is the same primitive on the same kind of input.

// CIDR blocks (v4) refused by default: this-network, private, CGNAT,
// link-local (includes the 169.254.169.254 metadata IP), IETF protocol
// assignments, benchmarking, reserved, and broadcast.
const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
];

function v4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const b = Number(p);
    if (b > 255) return null;
    n = (n * 256) + b;
  }
  return n;
}

// A host literal that names a non-public v4 address, in every spelling the C
// `inet_aton` rules (which Node's URL parser follows) accept: a dotted quad,
// a bare 32-bit integer (`2130706433` = 127.0.0.1), octal (`0177.0.0.1`), hex
// (`0x7f.0.0.1`), and short dotted forms (`127.1`, `0x7f.1`).
function isPrivateV4Literal(host) {
  const groups = host.split('.');
  if (groups.length > 4) return false;
  const nums = [];
  for (const g of groups) {
    let n;
    if (/^0x[0-9a-f]+$/i.test(g)) n = parseInt(g, 16);
    else if (/^0[0-7]+$/.test(g)) n = parseInt(g, 8);
    else if (/^\d+$/.test(g)) n = Number(g);
    else return false;
    if (!Number.isInteger(n) || n < 0) return false;
    nums.push(n);
  }
  if (!nums.length) return false;
  const maxLast = 256 ** (5 - nums.length);
  if (nums[nums.length - 1] >= maxLast) return false;
  for (let i = 0; i < nums.length - 1; i++) if (nums[i] > 255) return false;
  let value = 0;
  for (let i = 0; i < nums.length - 1; i++) value = (value * 256) + nums[i];
  value = (value * maxLast) + nums[nums.length - 1];
  return V4_BLOCKS.some(([base, bits]) => (value >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)));
}

// Parse an IPv6 literal into its eight 16-bit groups, or null when the string
// is not a well-formed v6 address. Handles `::` compression and an embedded
// dotted-quad tail (`::ffff:127.0.0.1`), which the URL parser normalizes to
// hex (`::ffff:7f00:1`) before we ever see it, so both spellings must parse.
function v6Groups(host) {
  let h = String(host).toLowerCase();
  if (!h.includes(':')) return null;
  const dotted = h.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const n = v4ToInt(dotted[1]);
    if (n === null) return null;
    h = h.slice(0, dotted.index) + ((n >>> 16).toString(16)) + ':' + ((n & 0xffff).toString(16));
  }
  const halves = h.split('::');
  if (halves.length > 2) return null;
  const toGroups = (s) => (s === '' ? [] : s.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : null)));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head.includes(null) || tail.includes(null)) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...Array(fill).fill(0), ...tail];
}

const v4FromGroups = (hi, lo) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

// IPv6 loopback/unspecified, IPv4-mapped/translated/compatible, NAT64, 6to4,
// and the unique-local (`fc00::/7`) + link-local (`fe80::/10`) ranges.
// Brackets are stripped by the caller. The embedded-IPv4 forms are the ones a
// dotted-suffix check misses: Node's URL parser rewrites `::ffff:127.0.0.1`
// to `::ffff:7f00:1`, so the loopback is only visible once the low 32 bits are
// reassembled from the hex groups.
function isPrivateV6Literal(host) {
  const g = v6Groups(host);
  if (!g) return false;
  if (g.every((x) => x === 0)) return true; // `::`
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // `::1`
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateV4Literal(v4FromGroups(g[6], g[7])); // ::ffff:a.b.c.d
  if (g.slice(0, 4).every((x) => x === 0) && g[4] === 0xffff && g[5] === 0) return isPrivateV4Literal(v4FromGroups(g[6], g[7])); // ::ffff:0:a.b.c.d
  if (g.slice(0, 6).every((x) => x === 0) && (g[6] || g[7])) return isPrivateV4Literal(v4FromGroups(g[6], g[7])); // ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateV4Literal(v4FromGroups(g[6], g[7])); // 64:ff9b::/96
  if (g[0] === 0x2002) return isPrivateV4Literal(v4FromGroups(g[1], g[2])); // 2002::/16
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/**
 * True when the host names a private, loopback, link-local, unique-local, or
 * otherwise non-public address. `host` is the URL parser's `hostname` (brackets
 * stripped) or any bare host string.
 */
export function isPrivateHostLiteral(host) {
  // A trailing dot is the explicit-root FQDN spelling of the SAME host
  // (`localhost.` == `localhost`); the URL parser keeps it, so normalize it
  // away or every rule below is bypassable with one appended dot.
  const h = (host || '').replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!h) return false;
  // Well-known non-public NAMES that need no DNS to recognize: loopback, the
  // mDNS/local suffixes, and the cloud metadata hostname.
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === 'metadata.google.internal') return true;
  // A hostname (letters outside the numeric/hex alphabet) is not a private
  // literal; DNS-based rebinding is out of scope for a literal check.
  if (/^[0-9a-fx.]+$/.test(h)) {
    if (isPrivateV4Literal(h)) return true;
  }
  return isPrivateV6Literal(h);
}

/** The refusal reason a finding carries (shared wording with the sibling lane). */
export const PRIVATE_HOST_REASON = 'names a private, loopback, link-local, or otherwise non-public address (SSRF guard)';
