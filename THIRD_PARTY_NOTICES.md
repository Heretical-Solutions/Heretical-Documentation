# Third-Party Notices

Dependency inventory for the Heretical documentation portal. It supplements, and does not
replace, the superproject's aggregate notices or any product's own notices.

Exact resolved versions come from `package-lock.json` (theme), `eng/lib/common.sh`
(Doxygen pin), and `eng/sources.manifest.json` (source revisions). The generated
[provenance page](https://heretical-solutions.github.io/Heretical-Documentation/md_provenance.html)
records the revisions used by a specific build.

## Distribution model

This repository ships source only. The published artifact is a **prebuilt static site**
produced by `eng/build.sh` into the ignored `artifacts/site` directory and deployed by
GitHub Actions to GitHub project Pages at
`https://heretical-solutions.github.io/Heretical-Documentation/`.

The static payload conveys:

- Doxygen-generated HTML for the aggregated documentation and the portal landing page.
- Doxygen's own generated support assets (navigation, search, and stylesheet files).
- The pinned Doxygen Awesome CSS theme files listed under *Distributed components*.
- Portal-owned branding: `assets/custom.css` and `assets/favicon.svg`.
- This product's `LICENSE`, this `THIRD_PARTY_NOTICES.md`, and the applicable MIT,
  Apache-2.0, and Doxygen output-exception texts under `/licenses/`.

Nothing else is placed in the payload: no Doxygen binary, no restored source checkout, no
`node_modules`, no build script, no tool cache, and no repository documentation beyond the
aggregated set declared in `eng/sources.manifest.json`.

## Distributed components

| Component | Version | License | SPDX | Source | Files conveyed | Notice location |
|---|---|---|---|---|---|---|
| Doxygen Awesome CSS | 2.5.0 (commit `46483f1e5a70ffb9ecd3b82d0a1cd1b24edf13da`) | MIT | `MIT` | <https://github.com/jothepro/doxygen-awesome-css> | `doxygen-awesome.css`, `doxygen-awesome-sidebar-only.css`, `doxygen-awesome-sidebar-only-darkmode-toggle.css`, `doxygen-awesome-darkmode-toggle.js`, `doxygen-awesome-fragment-copy-button.js`, `doxygen-awesome-paragraph-link.js`, `doxygen-awesome-interactive-toc.js`, `doxygen-awesome-tabs.js` | `licenses/doxygen-awesome-css-LICENSE.txt`, published at `/licenses/doxygen-awesome-css-LICENSE.txt` |
| Google Material Icons glyphs | Embedded in Doxygen Awesome CSS at the exact theme commit; no separately resolved icon package | Apache License 2.0 | `Apache-2.0` | <https://fonts.google.com/icons>, as attributed in the theme source | Light/dark SVG glyphs in `doxygen-awesome-darkmode-toggle.js` and link SVG glyph in `doxygen-awesome-paragraph-link.js` | `licenses/apache-2.0-LICENSE.txt`; upstream source/license comments remain in the JS |
| Doxygen generated JavaScript support files | Doxygen 1.18.0 (revision `8e760943e5d9581a444cf327f43a0b4d20d29482`) | MIT | `MIT` | <https://github.com/doxygen/doxygen/tree/Release_1_18_0/templates/html> | `codefolding.js`, `cookie.js`, `menu.js`, `menudata.js`, `navtree.js`, `navtreedata.js`, and `search/search.js` | `licenses/doxygen-javascript-MIT.txt`; applicable generated files retain their own notices |

The theme is consumed unmodified from the pinned git commit through `npm ci`. It is never
forked, vendored as a submodule, or patched in place. The theme declares no runtime npm
dependencies. Its embedded Material Icons glyphs are inventoried separately above.

## Build-only components (not distributed)

| Component | Version | License | SPDX | Role |
|---|---|---|---|---|
| Doxygen | 1.18.0 (commit `8e760943e5d9581a444cf327f43a0b4d20d29482`) | GPL-2.0-or-later **with the upstream Doxygen output exception** | `GPL-2.0-or-later` (tool) | Documentation generator. The official Linux x86_64 release is downloaded, hash-verified, and restored into the ignored `artifacts/tools` directory. The binary is **not** distributed. |

Doxygen's upstream license statement grants a special exception so that documents derived
from the supplied input are not affected by the tool's GPL. The upstream GPL-2.0 text is
retained at `licenses/doxygen-LICENSE.txt`; the upstream copyright and output exception are
recorded in `licenses/doxygen-output-exception.txt` and included in the payload. The binary
is not distributed. Doxygen's generated JavaScript support files have separate MIT notices,
listed above and preserved with the payload.

Node.js, npm, `curl`, `git`, `tar`, and `sha256sum` participate only in restore, build, and
validation on the build host. None of their code is distributed in the payload.

## Aggregated documentation (canonical source, exact revisions)

The portal publishes selected documents that remain canonical in their owning repositories.
Each is aggregated at an exact commit recorded in `eng/sources.manifest.json`; relative links
and media inside a repository are preserved in the generated intermediate, and links that
fall outside the published set resolve to canonical exact-revision source URLs.

| Source | Repository | Commit | License of source |
|---|---|---|---|
| Heretical Development (workspace) | <https://github.com/Heretical-Solutions/Heretical-Development> | `ba131fe6838cba3411b0f709be5aaa754929b27f` | MIT (superproject `LICENSE`) |
| Heretical Development Blog | <https://github.com/Heretical-Solutions/Heretical-Blog> | `1c505359e5b4afb9323906b4b4589b00e676f57f` | MIT (blog `LICENSE`) |

Aggregating a document does not transfer ownership: the canonical text stays in the source
repository, and this portal reproduces it at a pinned revision. Both source repositories use
the same MIT license and Heretical-Solutions copyright recorded in the payload's `LICENSE`.
No first-party product source is published here, and no API reference is generated for
products that publish none.

## Portal-owned assets

`assets/custom.css` and `assets/favicon.svg` are Heretical authorship under this repository's
MIT license. The favicon is a simple product-owned mark; no stock or generated third-party
artwork is used.

## External runtime references

None. The portal loads no CDN assets, web fonts, or third-party scripts at browse time; the
theme CSS/JS is self-hosted from the pinned commit and copied into the payload.

## Obligations summary

| Obligation | Status |
|---|---|
| Retain MIT copyright and permission notices for distributed theme and Doxygen JavaScript code | Met: respective MIT texts under `/licenses/`; source notices also retained |
| Retain Apache-2.0 license and attribution for embedded Material Icons glyphs | Met: Apache-2.0 text under `/licenses/`; upstream icon source/license comments retained in the theme JS |
| Copyleft compliance for generated output | Doxygen binary is build-only and not distributed; generated documents are covered by the upstream output exception, while generated JavaScript support files retain their separate MIT license |
| Corresponding source for distributed compiled output | Not required by MIT; the pinned theme commit and this repository reproduce the payload |
| Source-availability for aggregated documentation | Met: each document links to its canonical repository at the exact revision |
| SBOM for releases | Not required in the initial phase; `package-lock.json` and `eng/sources.manifest.json` provide the machine-readable pin set |

No additional conditional or uncertain copyleft obligation was identified for the distributed
MIT/Apache-2.0 assets. Any future change that vendors additional theme code, enables a
CDN-backed component, or distributes a Doxygen binary must update this file in the same commit.
