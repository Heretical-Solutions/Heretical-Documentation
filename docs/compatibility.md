# Compatibility

Compatibility records for the documentation portal. This file states what was actually
tested rather than what is theoretically supported.

## Infrastructure handbook — 2026-11-16

The portal now has a task-oriented **Infrastructure handbook** landing page,
persistent header link, scale guides, per-tool quick starts, credential/access
instructions, troubleshooting, and links into the owning service references.
Canonical guides remain in the superproject and tool directories; portal content
is navigation-only. The assembler supports explicitly covered tracked Markdown
navigation hubs under `content/` and rejects generated provenance/source-availability
as tracked content.

Local-source validation passed with **56 declared source documents**, **81 HTML
files**, zero Doxygen warnings, and zero validation issues. Coverage includes the
new handbook and tool overview mappings. This is not a publication claim; the
reviewed portal and integrated superproject revisions still need their normal
commit/push and separate publication decisions.

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
| Container runtime | Docker 29.1.3 with pinned `node:20.18.0-bookworm` image `sha256:a7a3b7ec…4c23fc` | Structural checks, clean local-source restore, and full validation tested |

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
  CI supplies the scoped read-only source credential instead.
- GitHub Actions run `43540473334` validated portal revision
  `bbf9c69332648bd22b0035d6b17ee9d447b93f22` using the `WORKSPACE_READ_TOKEN` source
  credential, uploaded `artifacts/site`, and deployed the initial site. The published
  provenance records superproject `ba131fe6838cba3411b0f709be5aaa754929b27f` and blog
  `1c505359e5b4afb9323906b4b4589b00e676f57f`.
- The pinned `node:20.18.0-bookworm` workflow image also passed structural checks, clean
  restore with explicitly marked local non-production source overrides, and the complete
  validation suite with **0 issues** on 2026-11-15. This tests the CI runtime without a
  private-source token; it is not live Woodpecker scheduling evidence.
- Firefox desktop and mobile screenshots were inspected locally; interactive search,
  light/dark behavior, and browser-console acceptance remain manual checks.
- Registered-workspace local preview passes: 30 documents, 1306 internal references,
  272 fragment references, and zero Doxygen diagnostics. Registered portal-gitlink links
  resolve to the portal repository, not a superproject directory URL.

## The whitespace hazard and the sandbox

The workspace path contains spaces (`Heretical Development`). Doxygen 1.18 mis-resolves some
relative Markdown links when its working path contains whitespace: the same intermediate
tree that builds with zero warnings from a space-free path produced four
"unable to resolve reference" warnings from the spaced path. Both Doxygen passes therefore
run in a unique space-free sandbox (created under `${TMPDIR:-/tmp}/heretical-documentation`, or the whitespace-free
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
| CI/CD | Woodpecker structural and full-validation workflows implemented; live scheduling pending. GitHub Actions reduced to a manually dispatched Pages publication adapter on `master` with disclosure confirmation |

## Browser expectations

Doxygen Awesome 2.5.0 targets current evergreen browsers. No specific browser matrix was
executed for this delivery: responsiveness, the light/dark toggle, and search interaction
are verified only through generated output, link/asset resolution, and the loopback HTTP
smoke test, not by driving a browser. Automated browser checks are recorded as pending
manual verification, not as successes.

## Known limitations and unverifiable checks

| Item | Status |
|---|---|
| Live Pages URL, asset loading, console errors | Historical initial deployment verified; the revised manual adapter requires a new reviewed dispatch before current-revision claims |
| External link liveness (128 references) | Not checked; validation contacts no external network |
| Browser rendering / search interaction | Pending manual; not automated |
| macOS / Windows builds | Untested; the pinned Doxygen release is Linux x86_64 |
| Other Doxygen or theme versions | Untested; the pins are the verified combination |
| Woodpecker live execution and revised Actions adapter | Pending operator acceptance; workflows are linted locally, while authoritative portal commands passed locally. Historical Actions run `43540473334` does not validate the revised adapter |
| Clean recursive-checkout integration for the revised workflow | Pending until the revised portal/superproject revisions are committed and integrated; existing registered source pins are recorded above |

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
