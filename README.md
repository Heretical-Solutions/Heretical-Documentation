# Heretical Documentation Portal

Aggregated documentation portal for the Heretical workspace, built with
[Doxygen](https://www.doxygen.nl/) and the [Doxygen Awesome](https://github.com/jothepro/doxygen-awesome-css)
theme, published as a prebuilt static site on GitHub project Pages.

**Status:** local validation and the historical initial Pages deployment have passed.
Woodpecker structural and full-validation workflows are implemented but await live
repository/agent acceptance. GitHub Actions is now a manual-only Pages publication adapter;
its revised revision has not been dispatched.

| Field | Value |
|---|---|
| Workspace path | `sites/documentation/` |
| Canonical repository | <https://github.com/Heretical-Solutions/Heretical-Documentation> |
| Source branch | `master` |
| Published site | <https://heretical-solutions.github.io/Heretical-Documentation/> |
| Generator | Doxygen 1.18.0 (pinned, hash-verified, restored per build) |
| Theme | Doxygen Awesome CSS 2.5.0 (pinned git commit, `npm ci`) |
| License | MIT (see `LICENSE`) |

## What this portal is

A read-only aggregation of documentation that remains **canonical in its owning
repositories**. It publishes selected workspace and product documents at exact, pinned
source revisions, preserves their relative links and media, and resolves links that fall
outside the published set to canonical exact-revision source URLs. It stores no canonical
documentation of its own beyond portal navigation, branding, and configuration.

## Quick start

```sh
eng/restore.sh          # pinned Doxygen + theme (npm ci) + exact source revisions
eng/build.sh            # aggregate, generate, and assemble artifacts/site
eng/serve.sh            # preview at http://127.0.0.1:4000/Heretical-Documentation/
eng/validate.sh         # pins, warnings, links/anchors, coverage, hygiene, base path
```

See [`docs/quickstart.md`](docs/quickstart.md) for the full first-run procedure.

## Documentation

| Document | Contents |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Toolchain, inputs, and prerequisites |
| [`docs/build.md`](docs/build.md) | Clean restore, aggregation, generation, and build mode |
| [`docs/quickstart.md`](docs/quickstart.md) | Minimal local preview and review loop |
| [`docs/deployment.md`](docs/deployment.md) | Woodpecker validation and the manual Pages publication adapter |
| [`docs/compatibility.md`](docs/compatibility.md) | Tested toolchain and dependency combinations |
| [`AGENTS.md`](AGENTS.md) | Agent instructions for this repository |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Dependency inventory, licenses, and conveyed notices |
| [`eng/sources.manifest.json`](eng/sources.manifest.json) | Exact source revisions and coverage mapping |

## Layout

```text
.
├── Doxyfile               # Published portal entry (includes doxygen/*.cfg)
├── Doxyfile.fixture       # Non-published C# extraction fixture
├── content/index.md       # Portal landing page
├── doxygen/               # Shared Doxygen configuration and branded header
├── assets/                # Minimal product-owned branding (custom.css, favicon.svg)
├── docs/                  # Product documentation
├── eng/                   # Authoritative restore/build/serve/validate + aggregation
├── licenses/              # Upstream license texts retained for the record
├── tests/fixture/         # Non-published C# extraction fixture source
├── package.json / package-lock.json   # Pinned theme (exact git commit)
└── artifacts/             # Restored tools/sources, intermediates, and site; ignored
```

Generated and restored paths — `artifacts/` and `node_modules/` — are ignored and must
never be committed. `package.json` and `package-lock.json` are deliberately tracked so the
theme pin is reproducible.

## Model

The portal is **standalone**: it builds from its own canonical clone using only pinned
inputs (the Doxygen release, the theme commit, and the exact source revisions in
`eng/sources.manifest.json`). It never reads ambient sibling checkouts or moving branches.
The superproject is private, so its restore requires a read-only Git credential as described
in `docs/requirements.md`; CI uses a narrowly scoped secret without storing it in URLs or
artifacts. A documented local-preview override exists, but it is recorded in the generated
provenance page and never silently changes production provenance.
