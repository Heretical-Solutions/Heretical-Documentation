# Deployment

GitHub Actions + Pages **artifact** deployment to GitHub project Pages. This is the
approved portal publication model; it differs from the blog's manual `gh-pages`
publication. There is no `gh-pages` branch and no Jekyll build on GitHub.

## Output identity

| Field | Value |
|---|---|
| Artifact | Prebuilt static Doxygen site: HTML, theme CSS/JS, portal branding, license texts, notices, provenance page |
| Producer | `eng/build.sh` → `artifacts/site` (the only uploaded path) |
| Host | GitHub project Pages |
| URL | `https://heretical-solutions.github.io/Heretical-Documentation/` |
| Origin / base path | `https://heretical-solutions.github.io` / `/Heretical-Documentation` |
| Processing | Disabled: `.nojekyll` at the payload root, so GitHub performs no Jekyll build |
| Links | Doxygen emits relative URLs, so the site is base-path agnostic under `/Heretical-Documentation/` |

There is no custom domain, CNAME, DNS record, or external certificate. GitHub issues and
renews the `github.io` certificate.

## Workflow

`.github/workflows/pages.yml`:

- **Triggers.** Every PR runs `eng/check-structure.sh` without source credentials. A
  same-repository PR also runs the full restore/build/validation without publishing. Fork
  and Dependabot PRs run structural checks only: they receive no private-source token and
  cannot claim a full build. A `push` to `master` or a manual dispatch of the `master`
  workflow may deploy; manual dispatch from another branch cannot publish.
- **Least privilege.** Default `contents: read`. Only the restore step receives the optional
  read-only `WORKSPACE_READ_TOKEN` for the private superproject. The deploy job alone adds
  `pages: write` and `id-token: write` and targets the protected `github-pages` environment.
- **Exact-SHA dispatch.** Optional `superproject_sha` / `blog_sha` inputs feed
  `eng/restore.sh` as `PORTAL_SRC_<ID>_SHA`, so a dispatch can aggregate a newer exact
  source revision (for example the superproject registration commit) without a circular
  portal↔gitlink sequence. Blank inputs use the manifest pins.
- **Immutable pins.** Actions are pinned to reviewed commit SHAs, not moving tags:

  | Action | Commit | Release |
  |---|---|---|
  | `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 |
  | `actions/setup-node` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | v7.1.0 |
  | `actions/upload-pages-artifact` | `fc324d3547104276b827a68afc52ff2a11cc49c9` | v5.0.0 |
  | `actions/deploy-pages` | `368f82528645a54fb793d4d04e342629a3f51346` | v5.0.1 |

- **Concurrency.** A single non-cancelling `pages` group so a deployment is never
  interrupted mid-flight.
- **Consistency.** The workflow runs the same authoritative commands as local validation:
  `eng/restore.sh` then `eng/validate.sh`, and uploads only `artifacts/site`.

## Prerequisites (user, once)

- A clean, reviewed `master` commit that is **pushed and canonically available**. Never
  deploy a commit that exists only locally.
- Repository **Settings → Pages → Source → GitHub Actions**. This one-time setting is
  outside the workflow; the `github-pages` protected environment then appears automatically.
- Repository **Settings → Secrets and variables → Actions → New repository secret**:
  `WORKSPACE_READ_TOKEN`. Use a fine-grained read-only token restricted to
  `Heretical-Development` with **Contents: Read**. The portal's automatic `GITHUB_TOKEN`
  cannot read that private repository. Do not add this token to URLs, source, logs, or
  the protected deployment environment.
- **Disclosure approval:** review every manifest-selected superproject document. Its source
  repository is private, but the generated documentation will be public. Approval of the
  source commit alone is not disclosure approval for deployment.

## Verified initial deployment

Actions run `43540473334` validated and deployed portal source
`bbf9c69332648bd22b0035d6b17ee9d447b93f22`, with superproject input
`ba131fe6838cba3411b0f709be5aaa754929b27f` and blog input
`1c505359e5b4afb9323906b4b4589b00e676f57f`. The Pages endpoint is live at the URL above.
The workflow does not itself require a separate reviewer approval: required reviewers are
configured in the `github-pages` environment and must be checked in the control plane when
an explicit approval hold is required.

## Procedure

1. Open a pull request. Same-repository CI runs `eng/restore.sh` and `eng/validate.sh` and
   does **not** publish. Fork and Dependabot PRs run only `eng/check-structure.sh`, without
   `WORKSPACE_READ_TOKEN`; full validation must be established from a trusted branch before
   merge. Review the build and the provenance page.
2. Merge to `master`. The `push` trigger builds, validates, uploads `artifacts/site`, and
   deploys through the protected `github-pages` environment. Approve deployment only after
   the private-source disclosure review.
3. For the final registration content, run a manual `workflow_dispatch` **from `master`** with
   `superproject_sha` set to the newly registered superproject `develop` commit so the
   portal aggregates the revision that records the gitlink. This is the intended
   exact-SHA override, not a moving-branch track.

## Smoke tests after publication (pending manual)

These require the live URL and cannot be completed from a source checkout or the loopback
smoke test. Record them as pending until someone runs them against
`https://heretical-solutions.github.io/Heretical-Documentation/`:

- Landing page renders with the sidebar title, favicon, and tree navigation.
- A workspace document (for example Architecture overview) opens and its relative
  cross-links resolve inside the portal.
- A blog product page opens under the blog section; its out-of-set links point at the
  canonical exact-revision blog source on GitHub.
- Search returns results; light/dark toggle and responsive layout behave; no browser-console
  errors where practical.
- `/Heretical-Documentation/licenses/doxygen-awesome-css-LICENSE.txt`,
  `/Heretical-Documentation/licenses/doxygen-javascript-MIT.txt`,
  `/Heretical-Documentation/licenses/doxygen-output-exception.txt`,
  `/Heretical-Documentation/licenses/apache-2.0-LICENSE.txt`,
  `/Heretical-Documentation/LICENSE`, and the provenance page are reachable.
- The 128 external links counted by validation are live (external liveness is not checked
  by `eng/validate.sh`).

## Traceability

| Direction | Mechanism |
|---|---|
| Deployment → source | The GitHub Actions run is tied to the `master` commit (or the dispatched exact SHAs); the deployed provenance page records the source revisions, toolchain, coverage, and link rewrites |
| Source → deployment | GitHub Pages deployment history in the repository's Insights → Pages, and the Actions run log |
| Reproduce | Check out the recorded `master` commit, run `eng/restore.sh && eng/build.sh`, compare `artifacts/site` against the uploaded payload |

The superproject gitlink must point at the portal **source** commit on `master`, never at a
deployment artifact.

## Rollback

Pages serves the latest successful deployment. To roll back, re-run the workflow on the last
known-good `master` commit (or dispatch with the previously used exact SHAs); the previous
payload returns once propagation finishes. Because the payload is fully reproducible from any
source revision, no separate artifact store is required.

## Secrets and permissions

- The private superproject requires `WORKSPACE_READ_TOKEN`, scoped to that repository with
  read-only Contents access. It is exposed only to `eng/restore.sh` and consumed through
  Git askpass. The token is not persisted in the source checkout or artifacts.
- Fork and Dependabot PRs receive no private-source secret and run structural checks only.
- Remote URLs must stay credential-free. Never use a token-bearing remote.
- Build validation does not constitute disclosure approval for making private documents
  public; the user must explicitly approve deployment after reviewing the selected content.
- Deployment requires the protected `github-pages` environment; write permissions are scoped
  to the deploy job only.

## Explicitly not deployed

No `gh-pages` branch, no custom domain/CNAME/DNS, no external certificate, no
Jekyll-on-GitHub build, no repository webhooks, no analytics, and no third-party source
submodule. Automated browser testing and external-link liveness are not part of the pipeline.
