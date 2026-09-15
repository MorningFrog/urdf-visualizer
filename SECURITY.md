# Dependency security maintenance

## Runtime input processing

- Xacro XML uses `@xmldom/xmldom` 0.9.12 or later within 0.9.x. Parsing stops on warnings/errors; output serialization explicitly enables `requireWellFormed`. Existing literal `<` comparisons inside `${...}` attributes are escaped before parsing. Invalid XML outside those expressions is rejected.
- YAML uses `js-yaml` 4.3.2 or later within 4.x, with `maxDepth: 100` and `maxTotalMergeKeys: 10000`. Workspace real-path checks and the 10 MiB per-file limit remain enabled. The dependency also limits the number of sources in a single merge sequence; unusually large configurations may now be rejected.
- Expression evaluation uses `expr-eval-fork` 3.0.3 or later within 3.x. Custom dotted/bracket property reads reject `__proto__`, `prototype`, `constructor` and inherited properties. Normal dictionary fields, array indices and string/array lengths remain supported.
- Parsing/serialization failures stop the current preview update and report an error. These changes address the identified dependency vulnerabilities; they do not impose a universal CPU/memory limit on arbitrary Xacro macro expansion.

## Locked build and release tooling

Run `npm run ci:install` to install both lockfiles without the root postinstall resolving the frontend again. Run `npm run audit:all` to audit both projects against the official npm registry; some mirrors do not implement the audit API.

VSCE is a locked local development dependency. The root `@vscode/test-cli` override selects Mocha 12 because the runner's declared Mocha 11 dependency still brings vulnerable `diff` and `serialize-javascript` versions. Full extension tests validate this override. Remove it once the runner supports a fixed dependency chain directly; do not replace it with an automatic runner downgrade.

Dependabot checks `/` and `/webview`. The security workflow audits, builds, runs stable VS Code tests and minimum-version smoke, and packages the VSIX. Release installation also uses the lockfiles and runs both audits. No advisories are currently suppressed.

## Verification record (2026-09-15)

- Official npm audit: zero vulnerabilities in both dependency trees after the update.
- Runtime parser regression tests include malformed XML, injected DOM names/control characters, YAML merges, safe property access, and prototype access rejection. Hostile XML/YAML resource cases run in a subprocess with a 192 MiB heap limit and a 10 second timeout.
- Compared all 58 Xacro files in the local `urdf-visualizer-test` collection against the pre-fix parser. All 51 previously successful files produced byte-identical serialized XML. The other 7 retained their original missing-input or intentional workspace-boundary failures.
- A clean installation of both lockfiles passed the full 21-test suite (including the external collection) in VS Code 1.122.1. The separate activation/preview smoke also passed on that version.
- A Chromium check of the production Webview loaded the PR preview's STL resource, changed its shoulder joint from 0.35 to 0.7 radians and verified the displayed angle, exercised the four measurement-mode toggles/cancel, and switched to plain URDF and the GLB texture model without page errors. This checks mode selection, not measurement accuracy or every GPU/platform combination.
- The VSIX packages the extension bundle and frontend assets without `node_modules`; development scripts and security test fixtures are excluded.
- Local VS Code 1.70 download was blocked by a TLS connection failure. The minimum-version smoke is included in CI; a successful local stable-version test does not substitute for that compatibility check.
