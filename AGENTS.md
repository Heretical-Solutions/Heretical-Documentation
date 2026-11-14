# Heretical Documentation Portal — Product Agent Instructions

These are the product-level instructions for the documentation portal repository. They
extend the workspace root `AGENTS.md` and the documentation-site agent rules; they do not
weaken workspace history-separation, dependency, provenance, or licensing rules.

## 1. Identity and ownership

| Field | Value |
|---|---|
| Workspace path | `sites/documentation/` |
| Canonical repository | `https://github.com/Heretical-Solutions/Heretical-Documentation` |
| Product type | Website (documentation portal) |
| Maintainers | Heretical Solutions |
| Build mode | Standalone — builds from its own canonical clone using pinned inputs |
| Primary outputs | Prebuilt static Doxygen site deployed by GitHub Actions Pages artifact |
| Source branch | `master` |
| Published URL | `https://heretical-solutions.github.io/Heretical-Documentation/` |
| Release ownership | This repository, through its own reviewed GitHub Actions workflow |

Purpose: aggregate maintained workspace and product documentation into one browsable,
searchable portal with stable URLs, a consistent look, and cross-product navigation, while
leaving every document canonical in its owning repository.

This repository owns:

- Portal-only content: the landing page (`content/index.md`), navigation, and minimal
  branding (`assets/`).
- Doxygen configuration (`Doxyfile`, `Doxyfile.fixture`, `doxygen/`) and the non-published
  C# extraction fixture (`tests/fixture/`).
- The exact source manifest and coverage mapping (`eng/sources.manifest.json`).
- The authoritative commands (`eng/`), GitHub Actions Pages workflow, and this product's
  documentation, licensing, and notices.

It does not own canonical product documentation, source code, APIs, releases, changelogs,
ADRs, planning cards, the blog's editorial content, GitHub Pages settings beyond its own
repository, or superproject submodule registration.

## 2. Repository layout

```text
documentation/
├── Doxyfile                 # Published portal entry; includes doxygen/*.cfg
├── Doxyfile.fixture         # Non-published C# extraction fixture
├── content/index.md         # Portal landing page (Doxygen main page)
├── doxygen/                 # common.cfg, html.cfg, branded header.html
├── assets/                  # custom.css, favicon.svg (minimal, product-owned)
├── docs/                    # requirements, build, quickstart, deployment, compatibility
├── eng/                     # Authoritative restore/build/serve/validate + aggregation
│   ├── lib/common.sh
│   ├── restore.sh  build.sh  serve.sh  serve.mjs  validate.sh
│   ├── check-structure.sh  source-askpass.sh
│   ├── assemble.mjs  coverage.mjs  checks.mjs  warn-gate.mjs  verify-pins.mjs
│   ├── sources.manifest.json  warning-allowlist.txt
├── licenses/                # Upstream license texts retained for the record
├── tests/fixture/           # Non-published C# extraction fixture source
├── package.json / package-lock.json   # Pinned theme (exact git commit)
├── README.md  LICENSE  THIRD_PARTY_NOTICES.md  AGENTS.md
├── .github/workflows/pages.yml
└── artifacts/               # Restored tools/sources, intermediates, site; ignored
```

`artifacts/` and `node_modules/` are ignored and never committed. `package.json` and
`package-lock.json` are tracked so the theme pin is reproducible. Create directories only
when needed; add no placeholder documents, speculative products, or empty API sections.

## 3. Requirements and supported targets

| Requirement | Version/configuration | Reason |
|---|---|---|
| Doxygen | `1.18.0`, official Linux x86_64 release | Pinned generator; restored per build, hash- and version-verified |
| Doxygen Awesome CSS | `2.5.0` at commit `46483f1e5a70ffb9ecd3b82d0a1cd1b24edf13da` | Pinned theme via `npm ci` |
| Node.js / npm | `20.18.0` / `10.9.0` (verified) | Theme install and the `eng/*.mjs` tooling |
| Git | any current | Exact-SHA source clones in `eng/restore.sh` |
| `curl`, `sha256sum`, `tar` | any current | Doxygen download and verification |
| POSIX shell + GNU coreutils | any current | `eng/` scripts |

- Build host verified: Linux `x86_64` (`x64`). macOS/Windows are not verified; the pinned
  Doxygen release is the Linux x86_64 build.
- Network is required for the first `eng/restore.sh` (doxygen.nl, GitHub, the npm git
  dependency). Validation contacts no external links and runs a loopback HTTP smoke only.
- No global or system Doxygen/npm installation is permitted. The Doxygen binary lives under
  ignored `artifacts/tools`; the theme under ignored `node_modules`.
- The canonical superproject is private. Its restore needs an existing local Git credential
  or `PORTAL_SOURCE_TOKEN`, supplied in CI by the read-only `WORKSPACE_READ_TOKEN` secret.
  `eng/source-askpass.sh` answers Git prompts without placing tokens in URLs, disk files,
  source checkouts, reports, or artifacts. Do not print or commit source credentials.
- Selected private-source documents become public HTML when deployed. Every manifest entry
  requires disclosure review before publication; never expand coverage to unreviewed files.

## 4. Authoritative commands

Run from this repository root. Quote paths in shells; the workspace path contains spaces.

| Purpose | Command |
|---|---|
| Clean restore | `eng/restore.sh` (add `--clean` to discard restored tools/theme/sources first) |
| Production build | `eng/build.sh` → `artifacts/site` |
| Local preview | `eng/serve.sh` → `http://127.0.0.1:4000/Heretical-Documentation/` |
| Full validation | `eng/validate.sh` (add `--skip-build` to reuse the current payload) |
| Source-independent checks | `eng/check-structure.sh` (no source credential or restored inputs; used for untrusted PRs) |

`eng/validate.sh` is the single authoritative check. It verifies the pins, builds, gates
Doxygen diagnostics against `eng/warning-allowlist.txt`, runs `eng/checks.mjs` (internal
links, anchors, base-path safety, navigation, coverage with no silent drops, required files,
and hygiene), runs a loopback HTTP smoke under the exact project Pages base path, and
asserts `artifacts/` and `node_modules/` are Git-ignored.

Documented overrides (never silently change production provenance):

- `PORTAL_SRC_<ID>_PATH=<dir>` — aggregate from a local checkout instead of cloning.
  Recorded as `local-override` in `artifacts/restore-manifest.json` and flagged
  non-production in the generated provenance page. For preview only; never a publication.
- `PORTAL_SRC_<ID>_SHA=<40-hex>` — clone an alternate exact commit (CI dispatch). Recorded
  as `dispatch-sha`; out-of-set links point at that revision.

There is no package, unit-test suite, or cross-product integration target in this
repository. The fixture is a build step, not a published product. Do not invent commands
beyond those above.

## 5. Dependency policy

- **Doxygen** is a pinned build-only tool. Restore downloads the official release, verifies
  SHA-256 and `--version`, and extracts into ignored `artifacts/tools`. Never use an
  arbitrary system `doxygen`, and never install globally.
- **Doxygen Awesome CSS** is consumed from the pinned git commit through `npm ci` against
  the committed `package-lock.json`. Do not fork it, vendor it as a submodule, or patch it
  in place. Only the referenced CSS/JS is staged into ignored `artifacts/doxygen/theme` and
  copied into the payload; its MIT license travels with the payload.
- **Sources** are cloned at the exact commits in `eng/sources.manifest.json` into ignored
  `artifacts/sources` and SHA-verified. Default builds never use ambient sibling checkouts
  or moving branches. The manifest is the authoritative coverage map; do not recursively
  crawl repositories or publish unlisted files.
- No first-party project references: this product consumes no other Heretical product as
  code. It aggregates documentation from pinned revisions only.
- Never reference another repository's `bin/`, `obj/`, `artifacts/`, or generated output.

Build mode is **standalone**: the repository builds from its own canonical clone using only
the pinned inputs.

## 6. Content and coverage rules

- Canonical documentation stays in its owning repository. The portal publishes selected
  documents at exact revisions and stores no canonical copy in tracked content.
- Aggregation preserves each repository's relative layout in the ignored intermediate so
  ordinary relative links and co-located media resolve. `MARKDOWN_ID_STYLE = GITHUB` makes
  heading anchors match the GitHub slugs used by the source, so `file.md#section` links
  resolve in the portal.
- Links that fall outside the published set (excluded same-repo files and cross-repository
  mounts such as `sites/blog/...`) are rewritten **only in the generated intermediate** to
  canonical exact-revision source URLs. A registered portal gitlink in a workspace catalog
  resolves to this repository at that exact revision, not a superproject directory URL.
  Canonical sources are never edited for the portal.
- Every intended input must produce an output. `eng/checks.mjs` fails on any published
  document that Doxygen silently dropped (for example, a `README.md`/`index.md` basename,
  which Doxygen special-cases; the assembler renames such basenames and fixes links).
- Products that publish no library API (for example, the blog) get overview and guides only,
  never a fabricated API section, product page, namespace index, or member list.
- The generated provenance page records the actual revisions, toolchain, coverage, and link
  rewrites of each build.
- The C# fixture proves extraction only. Extraction never implies compilation, runtime
  behaviour, or Unity/engine compatibility, and the fixture output is never published.

## 7. Deployment rules

- Publication is GitHub Actions + Pages **artifact** deployment to GitHub project Pages at
  `https://heretical-solutions.github.io/Heretical-Documentation/`. There is no
  `gh-pages` branch, no Jekyll-on-GitHub build, no CNAME, custom domain, DNS, or external
  certificate.
- The workflow (`.github/workflows/pages.yml`) validates same-repository pull requests
  without publishing. Fork and Dependabot PRs run only `eng/check-structure.sh` without the
  private-source token; this is not a full build. Only a push to `master`, or a manual
  `workflow_dispatch` of the `master` workflow carrying exact source SHAs, may deploy.
- Default `contents: read`; `pages: write` and `id-token: write` only for the deploy job;
  deployment targets the protected `github-pages` environment; actions are pinned to
  reviewed immutable commits; Pages concurrency is non-cancelling.
- The payload is `artifacts/site` only: generated HTML, theme CSS/JS, portal branding,
  `.nojekyll`, the license texts, notices, and the provenance page. No tools, sources,
  `node_modules`, caches, logs, fixture output, credentials, or machine paths.

## 8. Documentation requirements

Maintain in this repository: `README.md`; `docs/requirements.md`; `docs/build.md`;
`docs/quickstart.md`; `docs/deployment.md`; `docs/compatibility.md`;
`THIRD_PARTY_NOTICES.md`; `licenses/`; this `AGENTS.md`. Update documentation in the same
commit as any behavior, command, pin, coverage, target, or output change.

## 9. Licensing requirements

- `LICENSE` — MIT for this repository's portal code, configuration, and branding.
- `THIRD_PARTY_NOTICES.md` — direct and relevant transitive inventory with exact versions,
  SPDX identifiers, dependency form (distributed, build-only, or aggregated), conveyed
  files, and obligations.
- `licenses/` — applicable upstream texts retained for the record and published with the
  payload: the theme MIT, Doxygen JavaScript MIT, Material Icons Apache-2.0, and Doxygen
  output exception. The build-only Doxygen GPL text is retained but not distributed.
- Doxygen is a GPL-2.0-or-later build-only tool with the upstream document-output exception;
  its binary is not distributed. Doxygen's generated JavaScript has separate MIT notices.
  The theme CSS/JS is MIT; its embedded Material Icons glyphs are Apache-2.0. All applicable
  license texts travel with the payload. Aggregated documentation remains MIT in its
  canonical repositories.
- Surface conditional obligations as explicit review triggers rather than claiming blanket
  compliance.

## 10. Agent change procedure

1. Read this file, the workspace root `AGENTS.md`, `docs/documentation-site.md`, and
   `docs/agents/documentation-site.md`.
2. Check this repository's Git status separately from the superproject.
3. Run `eng/restore.sh` before building; never reuse an ambient Doxygen or npm install.
4. Change only this repository. Do not stage product files into the superproject, and do
   not create `.gitmodules` or a gitlink from here.
5. Keep generated output, restored tools/sources, `node_modules`, intermediates, and logs
   out of the index.
6. Run `eng/validate.sh` and read its output; fix failures rather than relaxing assertions,
   and justify any unavoidable Doxygen warning in `eng/warning-allowlist.txt`.
7. Update `eng/sources.manifest.json` for any coverage change, and this `AGENTS.md`,
   `docs/`, and `THIRD_PARTY_NOTICES.md` in the same commit.
8. Inspect this repository's diff and `git diff --check` separately. Verify no credential,
   generated artifact, restored source, or machine-specific path is staged.
9. Commit and push only when authorized. Push the product change separately from any
   superproject gitlink or registration commit.

Completion means: a clean standalone `eng/restore.sh` and a passing `eng/validate.sh` from
this repository alone; zero ungated Doxygen warnings; every published document present in
coverage; all internal links, anchors, and base-path behavior verified; the fixture proven
but unpublished; provenance, notices, and license texts matching what is actually consumed;
and no workflow secret, generated output, or source checkout tracked.

## 11. Explicit non-goals

Not implemented and not to be inferred: custom domain/CNAME/DNS, `gh-pages` publication,
API references for products without a published API, first-party product code dependencies,
third-party source submodules, automated browser testing, external-link liveness checks in
validation, search-engine verification tokens, analytics, comments, or any document not
listed in `eng/sources.manifest.json`.
