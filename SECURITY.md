# Dependency security maintenance

## Runtime input processing

- Xacro XML uses `@xmldom/xmldom` 0.9.12 or later within 0.9.x. Parsing stops on warnings/errors; output serialization explicitly enables `requireWellFormed`. Existing literal `<` comparisons inside `${...}` attributes are escaped before parsing. Invalid XML outside those expressions is rejected.
- YAML uses `js-yaml` 4.3.2 or later within 4.x, with `maxDepth: 100` and `maxTotalMergeKeys: 10000`. Workspace real-path checks and the 10 MiB per-file limit remain enabled. The dependency also limits the number of sources in a single merge sequence; unusually large configurations may now be rejected.
- Expression evaluation uses `expr-eval-fork` 3.0.3 or later within 3.x. Custom dotted/bracket property reads reject `__proto__`, `prototype`, `constructor` and inherited properties. Normal dictionary fields, array indices and string/array lengths remain supported.
- Parsing/serialization failures stop the current preview update and report an error. These changes address the identified dependency vulnerabilities; they do not impose a universal CPU/memory limit on arbitrary Xacro macro expansion.

## Locked build and release tooling

Run `npm run ci:install` to install both lockfiles without the root postinstall resolving the frontend again. Run `npm run audit:all` to audit both projects against the official npm registry; some mirrors do not implement the audit API.

VSCE is a locked local development dependency. The root `@vscode/test-cli` override selects Mocha 12 because the runner's declared Mocha 11 dependency still brings vulnerable `diff` and `serialize-javascript` versions. Full extension tests validate this override. Remove it once the runner supports a fixed dependency chain directly; do not replace it with an automatic runner downgrade.

Dependency updates are manual; there is no Dependabot version-update configuration. The security workflow audits both `/` and `/webview`, builds, runs stable VS Code tests and minimum-version smoke, and packages the VSIX. Release installation also uses the lockfiles and runs both audits. No advisories are currently suppressed.

## Verification record (2026-09-15)

- Official npm audit: zero vulnerabilities in both dependency trees after the update.
- Runtime parser regression tests include malformed XML, injected DOM names/control characters, YAML merges, safe property access, and prototype access rejection. Hostile XML/YAML resource cases run in a subprocess with a 192 MiB heap limit and a 10 second timeout.
- Compared all 58 Xacro files in the local `urdf-visualizer-test` collection against the pre-fix parser. All 51 previously successful files produced byte-identical serialized XML. The other 7 retained their original missing-input or intentional workspace-boundary failures.
- A clean installation of both lockfiles passed the full 21-test suite (including the external collection) in VS Code 1.122.1. The separate activation/preview smoke also passed on that version.
- A Chromium check of the production Webview loaded the PR preview's STL resource, changed its shoulder joint from 0.35 to 0.7 radians and verified the displayed angle, exercised the four measurement-mode toggles/cancel, and switched to plain URDF and the GLB texture model without page errors. This checks mode selection, not measurement accuracy or every GPU/platform combination.
- The VSIX packages the extension bundle and frontend assets without `node_modules`; development scripts and security test fixtures are excluded.
- Local VS Code 1.70 download was blocked by a TLS connection failure. The minimum-version smoke is included in CI; a successful local stable-version test does not substitute for that compatibility check.

## CI checkout isolation

Stable tests and the VS Code 1.70 smoke test use independent temporary copies of the release files, collected with VSCE's `listFiles` and `PackageManager.None`. Test entry points stay in the source checkout. Each run has separate user-data and extensions directories, removed when the runner exits. VS Code can write extension metadata into the copy without changing the original manifest. `npm run test:tooling` checks that behavior and the packaging exclusions.

CI checks tracked files after installation, tests and packaging; it never restores files to conceal mutations. ESLint checks maintained `src/**/*.ts` sources, including the existing `eqeqeq` rule, rather than legacy generated JavaScript. Both workflows use `setup-node@v6`; the action's Node runtime is separate from the Node.js 22 build version selected by `.nvmrc` and the Node.js 16 extension host in VS Code 1.70.

Security CI runs on master pushes, pull requests, manual requests and the weekly schedule. New runs for the same PR cancel older runs. Pushing a PR branch no longer starts a duplicate push check.

CI isolation validation: clean lockfile installation, lint, compilation, 20 stable tests (VS Code 1.137.0), the optional 21-test fixture run, snapshot regression, minimum VS Code 1.70.0 smoke (Node 16.13.2), both official audits and VSIX packaging passed locally. Build checks were repeated with Node 22.19.0. The 1.70 archive was fetched from Microsoft's official download service and checked against its published SHA-256 after the normal download stalled. No test or packaging step changed tracked source files.

## Manual dependency update policy

`git pull` synchronizes commits and remote branch references. It does not run Dependabot or upgrade npm dependencies. The ten existing bump PRs were created by the former weekly Dependabot configuration (up to five PRs per project); they were not automatically merged. Removing that configuration stops scheduled version PRs after this change reaches the default branch. Existing remote PRs and branches are left for the maintainer to handle. Automatic security-update PRs and automatic merging remain disabled in the current repository settings.

The weekly/manual security workflow only reports audit results and validates the committed versions. It does not modify manifests, lockfiles or create upgrade PRs. For an update, select compatible target versions explicitly, update each affected manifest and lockfile together, inspect the dependency diff, and run `npm run ci:install`, `npm run audit:all`, `npm test -- --code-version stable`, `npm run test:tooling`, `npm run test:smoke -- 1.70.0` and `npm run vscode:package`. Review the final Git diff before committing. Avoid `npm audit fix --force`.

Ordinary `npm install` retains the frontend postinstall convenience and may resolve newer versions allowed by package ranges. Use `npm run ci:install` for a reproducible installation of both committed lockfiles. The installation and dependency-upgrade operations are separate from Git synchronization.

## Reviewed dependency PRs (2026-09-15)

These versions are integrated locally; the remote PRs have not been merged or closed.

| PR | Dependency | Decision |
| --- | --- | --- |
| #24 | `@typescript-eslint/visitor-keys` | Updated to 8.70.0 |
| #25 | Webview `urdf-loader` | Updated to 0.13.1 and adapted the four-argument mesh callback |
| #26 | Webview TypeScript 7.0.2 | Deferred; retain TypeScript 6.0.3 |
| #27 | `@typescript-eslint/parser` | Updated to 8.70.0 |
| #28 | Webview `hotkeys-js` | Updated to 4.0.8 |
| #29 | `@vscode/test-electron` | Updated to 3.1.0; build runner requires Node 22+, minimum extension host remains Node 16 |
| #30 | Webview `@tsconfig/node22` | Updated to 22.0.6 |
| #31 | `@eslint/plugin-kit` | Updated to 0.7.3 |
| #32 | Webview Vue | Updated to 3.5.42 with its matching internal packages |
| #33 | `@typescript-eslint/utils` | Updated to 8.70.0 |

All coupled TypeScript ESLint packages are synchronized to 8.70.0. No unrelated package versions were upgraded. The root lockfile's stale project version was synchronized from 5.2.0 to the existing manifest version 5.2.1; the extension version and VS Code minimum declaration were not changed.

`vue-tsc` 3.2.7 still loads `typescript/lib/tsc`, which TypeScript 7 removed. Reconsider #26 only after the checker supports the new compiler and both type checking and the production build have been validated. Vite transpilation alone does not detect this incompatibility.

The mesh callback receives `(path, manager, material, onComplete)`. STL and OBJ without authored vertex colors receive a clone of the URDF material. GLB/GLTF and DAE preserve their embedded materials and textures; OBJ vertex colors remain supported. Cached templates retain their original appearance, while each visual gets independent material objects. Geometry and textures may be shared without changing other visuals' material properties.

Validation after integration:

- Node 22.19.0 clean installation of both lockfiles, both official npm audits (zero vulnerabilities), source lint, extension compilation, production frontend build, stable VS Code 1.137.0 tests (20 self-contained / 21 with external models), four tooling/material tests, minimum VS Code 1.70.0 smoke and VSIX packaging passed. Hash checks after installation, tests and packaging found no unexpected tracked-file changes.
- The external collection retained 51 byte-identical successful Xacro results and seven expected failures. Browser validation of the production build covered the STL/YAML/include example, ordinary URDF, textured GLB, joint movement, measurement-mode selection and visual/collision toggles, with no page errors. Two differently colored visuals reused the cached STL without another resource request; screenshot pixel checks confirmed red and blue persisted independently and returned after visibility toggling.
- The VSIX contains the extension bundle and frontend assets without development scripts, test sources or `node_modules`. Its manifest retains version 5.2.1, VS Code `^1.70.0`, and has no test-generated `__metadata`.
- An additional `cd webview && npx vue-tsc --build` check remains failing on pre-existing frontend types: 66 diagnostics before the update, 62 after fixing four loader import paths, no new diagnostics. These errors are not suppressed and no existing check was disabled. Build success must not be interpreted as full frontend type-check success. The existing Vite large-chunk warning also remains.
- Browser checks use Linux Chromium with software rendering and do not establish measurement accuracy or coverage across all GPUs/operating systems. The updated GitHub workflows have been validated through their local commands; a remote run still requires pushing these commits.

## Compatible dependency refresh (2026-09-15)

The next manual refresh keeps extension 5.2.1, VS Code 1.70 and build Node 22. Stage 1 updates ESLint utilities/eslintrc/ESLint to 4.10.1/3.3.7/10.10.0, ts-loader to 9.6.2, TypeScript to 6.0.3, webpack/webpack-cli to 5.111.0/7.2.3 and fs-extra to 11.4.0. VS Code API types are pinned to exactly 1.70.0 rather than allowing the caret range to resolve newer APIs. TypeScript 7, js-yaml 5 and root Node 26 types remain deferred.

Stage 1 validation: Node 22 clean installation of both lockfiles, official audits (zero vulnerabilities), root dependency-tree validation, lint, development/production builds, 20 stable VS Code tests, four tooling tests, VS Code 1.70 activation/preview smoke and VSIX packaging passed. Tracked-file hashes remained unchanged after installation, tests and packaging. The pre-update baseline also passed all 21 tests with external models; the frontend has 62 pre-existing type diagnostics, recorded individually for comparison.

Stage 2 aligns root and frontend Three.js and its types at 0.186.0, declares the frontend dependencies explicitly, deduplicates Three.js in Vite, and aligns root URDFLoader with frontend 0.13.1. OrbitControls imports now include the package's `.js` suffix. The renderer uses `PCFShadowMap` because r186 removes `PCFSoftShadowMap` and otherwise emits a fallback warning. The four-argument mesh callback and per-visual material isolation remain in place.

Stage 2 validation: both clean lockfile installs, audits (zero vulnerabilities), dependency-tree checks, 21 stable tests including external Xacro fixtures, four tooling/material tests, minimum-version smoke, production build and VSIX packaging passed without unexpected tracked-file changes. The frontend type-check baseline improved from 62 to 59 diagnostics with no new diagnostic identities. A build-time module inspection found one Three.js package root. Production-browser screenshots retained the STL and textured GLB appearance.

The optional `scripts/check-webview.cjs` browser regression serves the real frontend with a test-only Vite module exposing existing stores. This module is never part of a shipping build and does not alter extension messages or public APIs. The test checks STL colors/opacity, OBJ vertex colors, DAE embedded material, optional external GLB textures, cache on/off/reuse, real mouse raycasts for 1 m distance / 90 degree angle / 0.5 square meter area, unit changes, cancellation cleanup, joint sliders and dragging, camera orbit/zoom, display/frame toggles, tooltips and settings inputs. Numeric measurements allow 0.5% relative or 0.005 absolute error because mouse positions are quantized to screen pixels. All these checks passed on Chromium with software rendering.

To run this optional browser suite without adding another project dependency, install Playwright 1.63.0 into a separate tools directory, install its Chromium, and run:

```sh
npm install --prefix /tmp/urdf-browser-tools --no-save playwright@1.63.0
/tmp/urdf-browser-tools/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/urdf-browser-tools/node_modules node scripts/check-webview.cjs
```

Set `URDF_VISUALIZER_FIXTURES` to the external model collection to include its textured GLB, and optionally set `CHROMIUM_EXECUTABLE` to use an existing browser. The suite cleans up its browser and server. The small STL/OBJ/DAE fixtures are committed under `scripts/fixtures` and are excluded from the VSIX along with the test runner.
