// Version numbers, major.minor.patch: patch for fixes, minor for features, major for a change people must relearn.
export const parse = (v) => v.split(".").map((n) => Number.parseInt(n, 10) || 0).concat(0, 0, 0).slice(0, 3);

export function bump(v, kind) {
  const [a, b, c] = parse(v);
  return kind === "major" ? `${a + 1}.0.0` : kind === "minor" ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
}

// Negative when a is older than b.
export function compare(a, b) {
  const [x, y] = [parse(a), parse(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export const newest = (vs) => vs.reduce((n, v) => (n === null || compare(v, n) > 0 ? v : n), null);
