# Requirements

Prerequisites for building, validating, and publishing the documentation portal.

## Toolchain

| Requirement | Version | Enforcement | Notes |
|---|---|---|---|
| Doxygen | `1.18.0` | `eng/lib/common.sh` pin; restore verifies SHA-256 and `--version` | Official Linux x86_64 release, restored into ignored `artifacts/tools`. Never a system/global Doxygen |
| Doxygen Awesome CSS | `2.5.0` @ `46483f1e5a70ffb9ecd3b82d0a1cd1b24edf13da` | `package.json` + committed `package-lock.json` via `npm ci` | Packaged theme from the exact git commit; never forked or vendored |
| Node.js | `20.18.0` | verified here | Runs the theme install and the `eng/*.mjs` tooling |
| npm | `10.9.0` | verified here | `npm ci` only |
| Git | current | `eng/restore.sh` | Exact-SHA clones under `artifacts/sources` |
| `curl`, `sha256sum`, `tar` | current | `eng/restore.sh` | Doxygen download and verification |
| POSIX shell + GNU coreutils | current | `eng/` scripts | — |

No global or system installation of Doxygen or the theme is required or permitted. The
Doxygen binary and the theme live entirely under ignored `artifacts/` and `node_modules/`.

## Site configuration requirements

| Setting | Required value | Why |
|---|---|---|
| Published origin | `https://heretical-solutions.github.io` | GitHub project Pages origin |
| Base path | `/Heretical-Documentation` | Repository project path; Doxygen emits relative links so the site works under it |
| `MARKDOWN_ID_STYLE` | `GITHUB` | Heading anchors match the GitHub slugs used by source docs so `file.md#section` links resolve |
| `WARN_AS_ERROR` | `NO` | Diagnostics are gated by `eng/validate.sh` against a reviewed allow list |
| `HAVE_DOT` | `NO` | No Graphviz dependency; graphs are not used |
| `GENERATE_LATEX` / RTF / MAN / DOCBOOK / SQLITE3 | `NO` | Only the static HTML payload is produced |

`eng/validate.sh` fails if the pins or the restored revisions drift.

## Inputs and outputs

| Kind | Path |
|---|---|
| Source of truth | `master` branch of this repository |
| Coverage + revisions | `eng/sources.manifest.json` (tracked) |
| Restored tool/theme/sources | `artifacts/tools`, `node_modules`, `artifacts/sources` (ignored) |
| Aggregated intermediate | `artifacts/intermediates` (ignored) |
| Doxygen output + XML + warn log | `artifacts/doxygen/main` (ignored) |
| Fixture output (non-published) | `artifacts/fixture` (ignored) |
| Deployable payload | `artifacts/site` (ignored) |
| Reports | `artifacts/restore-manifest.json`, `coverage-input.json`, `coverage.json`, `link-rewrites.json`, `checks.json` (ignored) |

## External services

No service is required beyond the restore-time download and source hosts, plus GitHub for
publication.

- **The pinned GitHub release asset** and the **npm git dependency** are contacted by
  `eng/restore.sh` on a cold cache.
- **GitHub** hosts the repository, runs the Actions Pages workflow, and serves Pages.
  Publication and Pages settings are outside the build.
- The blog and theme are publicly readable. The canonical superproject is **private**:
  its exact source restore requires either the developer's existing Git credential helper
  or `PORTAL_SOURCE_TOKEN` containing a narrowly scoped read-only token. CI supplies that
  variable from the `WORKSPACE_READ_TOKEN` secret only to the restore step. Git asks for the
  credential through `eng/source-askpass.sh`; tokens never appear in remote URLs, source
  checkouts, reports, or generated output. No webhooks or service accounts are created by
  this repository.

## Disclosure

The published site is public. Selected documentation from the **private** superproject
becomes public HTML when aggregated. The explicit coverage manifest is the disclosure
boundary: a maintainer must review every selected document for credentials, confidential
material, and unreleased security information before publication. Do not add unreviewed
private source content. Repository visibility alone does not make a Pages site private.
