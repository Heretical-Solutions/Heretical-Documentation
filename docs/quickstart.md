# Quick start

Minimal local procedure to build and review the portal from a clean clone.

## First run

```sh
git clone https://github.com/Heretical-Solutions/Heretical-Documentation.git
cd Heretical-Documentation
eng/restore.sh        # pinned Doxygen + theme (npm ci) + exact source revisions
eng/build.sh          # aggregate, generate, and assemble artifacts/site
eng/serve.sh          # preview at http://127.0.0.1:4000/Heretical-Documentation/
```

The superproject source is private. Use an existing local Git credential with read access,
or supply `PORTAL_SOURCE_TOKEN` through the environment as documented in `docs/build.md`.
Do not put a token in a repository URL, command history, or tracked file.

Open the printed URL. The site is served under the exact project Pages base path, so
relative links behave as they will once published. `eng/check-structure.sh` runs the
source-independent structural checks without Doxygen, a source checkout, or credentials.

## Review loop

After changing portal content, branding, Doxygen configuration, or the coverage manifest:

```sh
eng/validate.sh                  # full gate: pins, build, warnings, links, coverage, hygiene
eng/validate.sh --skip-build     # re-run checks against the current payload
```

`eng/validate.sh` is authoritative. Read its output and fix failures rather than relaxing
assertions. If Doxygen emits a warning you believe is unavoidable, justify it in
`eng/warning-allowlist.txt` in the same commit.

## Publishing a document

The portal publishes only what `eng/sources.manifest.json` lists. To add or move a
document:

1. Add its exact source path to the owning source's `files` array (and a `dest` rename if
   its basename is `README.md`/`index.md`, which Doxygen special-cases).
2. Ensure the source revision is a real, pushed commit on the canonical remote.
3. Link to it from `content/index.md` if it should appear on the landing page.
4. Run `eng/validate.sh`; coverage and link checks confirm it is published and reachable.

Never add a document by crawling a repository: coverage is explicit by design.

## Previewing uncommitted workspace changes

To review documentation that is not yet at the pinned revision (for example, pending
superproject amendments), use the documented local-preview override:

```sh
# Point the override at your local workspace checkout (replace the path):
WS='/path/to/Heretical Development'
PORTAL_SRC_SUPERPROJECT_PATH="$WS" eng/restore.sh
eng/build.sh
eng/serve.sh
```

This aggregates from the given checkout and marks the build **non-production** in the
generated provenance page. It is for review only and must never be used to publish.

## What you will not find here

There is no package command, no unit-test suite, and no cross-product integration target.
The C# fixture runs during `eng/build.sh` and stays unpublished under `artifacts/fixture`.
Ongoing validation runs on Woodpecker. Publication is a manually dispatched GitHub Actions Pages adapter, described in `docs/deployment.md`.
