// Redact token-shaped strings from a log before it is saved (run.sh keeps a logcat only when a test fails).
// The phone's log can hold other apps' tokens (2026-11-12: an Office access token). Errs on the side of
// removing too much: anything shaped like a JWT, a bearer/authorization value, a *token/*key/secret/password
// parameter, or a long opaque run of letters and digits.
//   node redact.mjs < raw.txt > redacted.txt

const R = '[REDACTED]';
const RULES = [
  // JWT or the start of one (a wrap or truncation can cut it anywhere after the header).
  [/eyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]*){0,2}/g, () => R],
  [/\b(Authorization|Proxy-Authorization)\s*[:=]\s*.+$/gim, (_m, k) => `${k}: ${R}`],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, () => R],
  [
    /\b([A-Za-z_-]*(?:token|secret|password|passwd|api[_-]?key|apikey|session|cookie|signature|sig))("?\s*[:=]\s*"?)([^\s"&,;]+)/gi,
    (_m, k, sep) => `${k}${sep}${R}`,
  ],
  // Long opaque strings: 32+ characters of base64/hex alphabet with at least one digit.
  [/\b(?=[A-Za-z0-9+/_-]*\d)[A-Za-z0-9+/_-]{32,}={0,2}/g, () => R],
];

export function redact(text) {
  return RULES.reduce((s, [re, fn]) => s.replace(re, fn), text);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => (input += c));
  process.stdin.on('end', () => process.stdout.write(redact(input)));
}
