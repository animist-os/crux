# Crux changelog

The version in `package.json` is stamped into every bundle as `golden.cruxVersion`.
Each bundle also carries `golden.cruxSourceHash`, a short hash of the source it
was built from. `node build.js --version` prints both for the current checkout.
If a host shows the same version but a different hash, its copy is out of date.

Bump the version for any change a host can notice: grammar, evaluation, the
`golden.*` API, or directives. Patch for fixes, minor for additions, major for
changes that can break existing programs or hosts.

## 2.2.0 (2026-11-24)

- Binary zip: `A z B` is `(A, B)z`, and `A z B z C` is one three-way zip.
  Postfix `z` applies only when no operand follows it.
- `z` followed by a letter, digit or `_` is part of a name, never the zip operator.
- Arithmetic and names inside a mot: `+ - * /` on numbers and on names bound to
  one number; range endpoints take the same (`[0 -> P]`).
- Member access is limited to `.length`, so `x . y` is always a tile-add.
- Fold view: stops 6 to 11, `#core` (with and without levels), hidden notes,
  splits fold onto the notes they replace.
- Build: `golden.cruxSourceHash` and a `Version:` banner line in each bundle;
  `node build.js --version`.

## 2.1.0 (2026-11-16)

- `seedEnv` option on `crux_interp` and `crux_env` for host-supplied bindings.

## 2.0.0 (2026-11-16)

- Breaking: `/` subdivides by total duration, not pip count.
