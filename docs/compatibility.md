# Compatibility

Compatibility records for the documentation portal. This file states what was actually
tested rather than what is theoretically supported.

## Tested combination

| Input | Version | Status |
|---|---|---|
| Operating system | Linux Mint 22.2 (Ubuntu 24.04 base), Linux `x86_64` | Tested |
| Doxygen | 1.18.0 (revision `8e760943e5d9581a444cf327f43a0b4d20d29482`) | Tested; official Linux x86_64 release, SHA-256 verified |
| Doxygen Awesome CSS | 2.5.0 (commit `46483f1e5a70ffb9ecd3b82d0a1cd1b24edf13da`) | Tested; installed via `npm ci` from the pinned git commit |
| Node.js | 20.18.0 | Tested |
| npm | 10.9.0 | Tested |
| Git | 2.43.0 | Tested, including exact-SHA shallow fetch |
| `curl` / `tar` / `sha256sum` | current | Tested (Doxygen download and verification) |
| Graphviz `dot` | not required | `HAVE_DOT = NO`; no graph dependency |
| Container runtime | Docker present but not used | Not required |

Validated with this combination, from a wiped `artifacts/` and `node_modules/`:

- Clean restore: Doxygen download + SHA-256 + version verification; theme `npm ci` +
  version/commit verification; both sources cloned at exact commits and SHA-verified.
- Production build in the space-free sandbox: 28 source documents aggregated, 112 link
  rewrites (93 in-set, 11 out-of-set, 8 cross-repo, 0 unresolved); 30 documents mapped to
  30 generated pages.
- Diagnostic gate: **0** Doxygen warnings, **0** errors.
- Payload inspection: 135 files, 39 HTML pages, 1304 internal references and 270 fragment
  references all resolving, 128 external references counted but not contacted, coverage
  complete with no silent drops, required payload files present, and hygiene clean (no
  portal machine path, restored checkout, `node_modules`, tool binary, fixture output, logs,
  caches, or credential material).
- C# fixture: documented type `SampleWidget` and members `Activate`/`charge` extracted from
  source alone with `UnityEngine`/`MonoBehaviour` unresolved and no stubs; fixture absent
  from the payload.
- Loopback HTTP smoke under `/Heretical-Documentation/`: base path, landing page, a
  generated document, theme CSS, a Doxygen asset, and a license text all return 200; missing,
  encoded-traversal, and malformed-encoding paths return 404 without stopping the server.
- Local-preview source override: restored the current workspace explicitly, rebuilt with
  120 link rewrites (93 in-set, 19 out-of-set, 8 cross-repo, 0 unresolved), and passed the
  full validation suite; the provenance records it as non-production.
- Git-ignore sanity: `artifacts/` and `node_modules/` are ignored.
- The eight-stage production validation passes with the exact source pins using the local
  Git read credential for the private superproject.
- The theme's clean HTTPS restore succeeds with an empty home and system/global Git
  configuration disabled; no SSH key is needed. The credential-free structural check also
  passes in that environment. Anonymous restore of the private superproject correctly fails;
  its CI read-only-token path has not run in GitHub Actions and remains a live check.

## The whitespace hazard and the sandbox

The workspace path contains spaces (`Heretical Development`). Doxygen 1.18 mis-resolves some
relative Markdown links when its working path contains whitespace: the same intermediate
tree that builds with zero warnings from a space-free path produced four
"unable to resolve reference" warnings from the spaced path. Both Doxygen passes therefore
run in a unique space-free sandbox (created under `/tmp/kilo`, or the whitespace-free
`PORTAL_BUILD_TMPDIR` parent) that mirrors the repository's relative layout and is removed
when the build exits; results are copied back into ignored `artifacts/`. This is the same
class of fix the blog applies to its Bundler gem path. Unlike the blog, Node/npm and the
theme install normally under the spaced repository path, so only the Doxygen run is
relocated.

## Supported ranges

| Input | Range | Basis |
|---|---|---|
| Doxygen | exactly `1.18.0` (pinned) | The pin is the verified release; other versions are untested and would change extraction/warning behaviour |
| Doxygen Awesome CSS | exactly `2.5.0` @ `46483f1e…` | The theme declares 1.9.6+ support; only this commit is verified here |
| Node.js | `>= 20` (verified `20.18.0`) | Runs the `eng/*.mjs` tooling and `npm ci` |
| Platforms | Linux `x86_64` verified | The pinned Doxygen release is Linux x86_64; macOS/Windows are untested |

## Site contract

| Aspect | Value | Notes |
|---|---|---|
| Published URL | `https://heretical-solutions.github.io/Heretical-Documentation/` | Project Pages; requires the repository name to remain `Heretical-Documentation` |
| Base path | `/Heretical-Documentation` | Doxygen emits relative links, so the payload is base-path agnostic; a rename is a breaking change |
| Anchor style | `MARKDOWN_ID_STYLE = GITHUB` | Heading anchors match the GitHub slugs used by source docs, so `file.md#section` links resolve in the portal |
| Aggregated revisions | `eng/sources.manifest.json` | Superproject `ba131fe…`, blog `1c505359…` for the initial build; CI dispatch may override with exact SHAs |
| Encoding | UTF-8 | Markdown and generated HTML |

## Feature matrix

| Feature | State |
|---|---|
| Client-side search | Enabled (Doxygen local search) |
| Tree navigation | Enabled (`GENERATE_TREEVIEW`) |
| Light/dark mode, responsive layout | Enabled (theme) |
| Fragment copy button, paragraph links, interactive TOC, tabs | Enabled (theme JS) |
| Code folding | Enabled |
| LaTeX / PDF / RTF / man / XML-in-payload / SQLite | Disabled (HTML payload only) |
| Graphviz class/collaboration diagrams | Disabled (`HAVE_DOT = NO`) |
| CDN / web fonts / third-party runtime scripts | None; theme CSS/JS is self-hosted from the pinned commit |
| C# API reference | Non-published fixture only; no product publishes a library API yet |
| CI/CD | GitHub Actions build/validate on PR; Actions Pages artifact deploy on `master`/dispatch |

## Browser expectations

Doxygen Awesome 2.5.0 targets current evergreen browsers. No specific browser matrix was
executed for this delivery: responsiveness, the light/dark toggle, and search interaction
are verified only through generated output, link/asset resolution, and the loopback HTTP
smoke test, not by driving a browser. Automated browser checks are recorded as pending
manual verification, not as successes.

## Known limitations and unverifiable checks

| Item | Status |
|---|---|
| Live Pages URL, asset loading, console errors | Pending: requires the Actions deploy and Pages settings |
| External link liveness (128 references) | Not checked; validation contacts no external network |
| Browser rendering / search interaction | Pending manual; not automated |
| macOS / Windows builds | Untested; the pinned Doxygen release is Linux x86_64 |
| Other Doxygen or theme versions | Untested; the pins are the verified combination |
| GitHub Actions execution | Not run from this environment; the workflow is linted structurally only |
| Clean recursive-checkout integration | Deferred until the superproject records the portal gitlink (no canonical source commit exists yet) |

## Release and versioning

This product has no package version and publishes no library artifact. Its versions are Git
revisions on `master`; each deployment is tied to a commit (or dispatched exact SHAs) and
recorded in the generated provenance page. Superproject tags will identify tested
combinations once the portal is registered as a submodule.

## Change rules

- A toolchain, theme, or source-pin change updates `eng/lib/common.sh`,
  `package.json`/`package-lock.json`, and `eng/sources.manifest.json` in the same commit as
  this file, `THIRD_PARTY_NOTICES.md`, and the coverage documentation, with
  `eng/validate.sh` passing from a clean restore.
- A Doxygen or theme upgrade is a compatibility change: re-check the header integration, the
  staged theme file list, `MARKDOWN_ID_STYLE`, the warning allow list, the coverage map, and
  payload hygiene, because generator or theme behaviour may change.
- A URL, base path, or aggregated-revision change is breaking and needs a link audit plus
  updated workspace documentation.
