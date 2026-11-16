# Build

Standalone build mode: this repository builds from its own canonical clone using only the
pinned inputs in `eng/lib/common.sh`, `package-lock.json`, and
`eng/sources.manifest.json`. It consumes no other Heretical product as code and needs no
workspace checkout layout.

## Clean restore

```sh
eng/restore.sh            # pinned Doxygen + theme (npm ci) + exact source revisions
eng/restore.sh --clean    # discard restored tools/theme/sources first
```

What it guarantees:

- The Doxygen release is downloaded to `artifacts/tools`, its SHA-256 is verified against
  the pin, it is extracted, and `doxygen --version` must report exactly `1.18.0`. No system
  `doxygen` is used.
- The theme is installed with `npm ci` from the committed `package-lock.json`; the installed
  version and the lock's resolved git commit must match the pins.
- Each source in the manifest is cloned at its exact commit into `artifacts/sources` and
  SHA-verified. Default restore never reads ambient sibling checkouts or moving branches.
- The resolved state is written to `artifacts/restore-manifest.json` and re-checked by
  `eng/validate.sh`.

### Private-source credentials

The canonical superproject is private; the blog and theme are public. A local production
restore may use an existing Git credential helper with read access. CI instead supplies
`PORTAL_SOURCE_TOKEN` from the `WORKSPACE_READ_TOKEN` repository secret. Use a fine-grained
token restricted to the superproject with **Contents: Read** only; the automatic portal
`GITHUB_TOKEN` cannot read another private repository.

When set, `eng/source-askpass.sh` answers only Git's username/password prompts. The token is
not placed in a URL, written to disk, included in the restore manifest, or exposed to later
build/validation steps. `PORTAL_SOURCE_USERNAME` defaults to `x-access-token`. Do not put a
literal token in shell history or documentation. The theme lockfile uses public HTTPS and
`npm ci --ignore-scripts`, so no GitHub SSH key or dependency lifecycle script is required.

### Overrides (documented, never silent)

- `PORTAL_SRC_<ID>_PATH=<dir>` aggregates from a local checkout. Recorded as
  `local-override`; the provenance page marks the build non-production. Preview only.
- `PORTAL_SRC_<ID>_SHA=<40-hex>` clones an alternate exact commit (CI dispatch). Recorded
  as `dispatch-sha`; out-of-set links use that revision.

## Aggregation model

`eng/build.sh` runs `eng/assemble.mjs`, which:

1. Copies each manifest-listed document from the restored sources into the ignored
   `artifacts/intermediates` tree, preserving each repository's relative layout under a
   section prefix (`workspace/…`, `products/blog/…`). Basenames Doxygen special-cases
   (`README.md`, `index.md`) are renamed via the manifest `dest` field and inbound links
   fixed, so no intended input is silently dropped.
2. Copies the portal landing page and tracked topic navigation hubs under `content/`, then generates the provenance page. Each navigation page is included in coverage; generated `provenance.md` and `source-availability.md` cannot be tracked content.
3. Rewrites links. Relative links whose targets are inside the published set are preserved
   (and resolve in Doxygen because `MARKDOWN_ID_STYLE = GITHUB` reproduces the source's
   GitHub-slug anchors). Links that fall outside the published set — excluded same-repo
   files and cross-repository mounts such as `sites/blog/...` — are rewritten **only in the
   intermediate** to canonical exact-revision source URLs. A registered portal gitlink in
   the workspace catalog resolves to this portal's own canonical repository at that exact
   revision, never a superproject directory URL. Canonical sources are never edited.
4. Emits `artifacts/coverage-input.json` and `artifacts/link-rewrites.json`.

Inline code spans and fenced code blocks are masked before link rewriting, so example paths
inside documentation are never mistaken for links.

## Generation

`eng/build.sh` stages the referenced theme files into `artifacts/doxygen/theme`, materialises
an effective `Doxyfile` under `artifacts/doxygen`, and runs the pinned Doxygen twice:

- **Published pass** (`Doxyfile`): input `artifacts/intermediates`, output
  `artifacts/doxygen/main/html`, XML to `artifacts/doxygen/main/xml`, warnings to
  `artifacts/doxygen/main/warn.log`. `USE_MDFILE_AS_MAINPAGE` makes the landing page
  `index.html`.
- **Fixture pass** (`Doxyfile.fixture`): input `tests/fixture`, output `artifacts/fixture`.
  Non-published; proves C# extraction from source alone with no dotnet, Unity, `.asmdef`,
  generated `.csproj`, or stubs.

`eng/coverage.mjs` then parses the published pass XML into `artifacts/coverage.json`, the
authoritative source-to-page map (the main page maps to `index.html`, not `indexpage.html`).

## Payload assembly

The deployable payload is `artifacts/site`:

- The Doxygen `html` output becomes the site root.
- `.nojekyll` disables GitHub's implicit Jekyll build.
- `LICENSE` (portal and aggregated Heretical MIT), `THIRD_PARTY_NOTICES.md`, the theme MIT
  text, Doxygen JavaScript MIT text, Material Icons Apache-2.0 text, and Doxygen output
  exception are copied into `/licenses/` or the payload root so notices travel with the
  static site. The build-only Doxygen GPL text stays in the repository `licenses/` only.

A source manifest entry declares `public: true` or `public: false`. Public sources retain
canonical source links/revisions. Private sources keep exact clone URLs/SHAs only in the
restore manifest and internal records; generated HTML and public provenance omit private
repository links/revisions and route out-of-set links to `source-availability.md`.
Developer-specific absolute paths are rejected from generated public output. These are
presentation/disclosure transforms, not changes to canonical source or licensing attribution.

Generated output stays entirely under ignored `artifacts/`. Nothing machine-specific is
written into tracked configuration: the tracked `Doxyfile` and `doxygen/*.cfg` use stable
paths relative to the repository root.

## Local preview

```sh
eng/serve.sh                                   # http://127.0.0.1:4000/Heretical-Documentation/
eng/serve.sh --host 127.0.0.1 --port 4001
```

`eng/serve.mjs` is a dependency-free static server that serves `artifacts/site` under the
exact project Pages base path, so relative URLs behave as they will in production. It binds
loopback only and contacts no external network.

## Woodpecker workflows

`.woodpecker/structural.yaml` runs the source-independent structural command without a
private-source credential. `.woodpecker/full-validation.yaml` restores the pinned inputs and
runs full validation on trusted `master` manual/cron triggers; only its restore step receives
the read-only `WORKSPACE_READ_TOKEN`. Neither workflow publishes. The manual GitHub Actions
Pages adapter revalidates before publication. Live Woodpecker scheduling remains an operator
acceptance gate and is not inferred from local command results.

## Validation

```sh
eng/validate.sh                  # pins, build, diagnostics, checks, HTTP smoke, git-ignore
eng/validate.sh --skip-build     # reuse the current artifacts/site payload
```

Eight steps, all of which must pass:

1. **Source-independent structure** (`eng/check-structure.sh`): shell/JavaScript syntax,
   locked HTTPS theme resolution, full source SHAs, and explicit non-conflicting coverage
   mappings. This command also runs alone for untrusted PRs without source credentials; it
   is not a full build.
2. **Pin verification** (`eng/verify-pins.mjs`): re-hash the Doxygen tarball, check the
   recorded Doxygen/theme versions and theme git commit in `package-lock.json`, and confirm
   each source checkout sits on its manifest commit (overrides are reported appropriately).
3. **Production build** as above.
4. **Diagnostic gate** (`eng/warn-gate.mjs`): zero errors and zero warnings outside
   `eng/warning-allowlist.txt`. The current build produces zero warnings.
5. **Payload inspection** (`eng/checks.mjs`): every internal link resolves to a real file;
   every internal `#anchor` resolves to a real `id`/`name`; no site-root-absolute reference
   (which would break under the base path); navigation assets referenced by the treeview
   exist; every published document produced a page (no silent drop); required payload files
   exist; and hygiene holds — no portal machine path, no restored checkout, no
   `node_modules`, no tool binary (ELF), no fixture output, no logs/caches, and no
   credential material. External links are counted, not contacted.
6. **C# extraction fixture**: the documented type and members are extracted without
   compilation, Unity, `.asmdef` resolution, generated projects, or stubs; the fixture stays
   out of the public payload.
7. **Loopback HTTP smoke** under `/Heretical-Documentation/`: the base path, landing page, a
   generated document, theme CSS, a Doxygen asset, and a license text return 200; a missing
   path, malformed percent-encoding, and encoded traversal return 404 without stopping the
   preview server.
8. **Git-ignore sanity**: `artifacts/` and `node_modules/` are ignored and never appear as
   trackable.

## Whitespace in the repository path

The workspace path contains spaces (`Heretical Development`). Node/npm handle the spaced
repository path, but Doxygen 1.18.0 mis-resolves some relative Markdown links when its
working path contains whitespace. Both Doxygen passes therefore run in a unique space-free
sandbox under `PORTAL_BUILD_TMPDIR` (default `${TMPDIR:-/tmp}/heretical-documentation`). The sandbox mirrors the repository's
relative layout, is removed when the build exits, and copies its results back into ignored
`artifacts/`. Failure diagnostics are copied to `artifacts/main.stdout.log` or
`artifacts/fixture.stdout.log` before cleanup. No restored tool or generated payload is left
outside the repository.

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| `Doxygen tarball SHA-256 mismatch` | Wrong or corrupted download; the pin is refused |
| `theme commit mismatch` | `package-lock.json` no longer resolves the pinned commit |
| `<id> checkout mismatch` | A manifest commit is not reachable on the canonical remote |
| `assemble: portal content link resolves to a missing published page` | The landing page links to a document not listed in the manifest |
| `checks: coverageMissing … indexpage.html` | Main-page mapping regression; `coverage.mjs` must map `indexpage` to `index.html` |
| A `README.md`/`index.md` document vanishes | Doxygen special-cases those basenames; add a manifest `dest` rename |
| Broken `file.md#anchor` in the payload | `MARKDOWN_ID_STYLE` drifted from `GITHUB`, or the anchor does not match a heading |
