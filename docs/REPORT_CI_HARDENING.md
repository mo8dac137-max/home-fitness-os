# REPORT — CI Workflow Hardening

**Date:** 2026-11-07 · **Type:** CI/tooling only — zero app, package, or server changes.

## 1. What and why

Four additive hardening measures to `.github/workflows/ci.yml`, none of which
changes what the pipeline checks:

1. **Least-privilege token** — a top-level `permissions: contents: read` block.
   Before this change, the workflow's implicit `GITHUB_TOKEN` carried the
   default write-scoped set; now it can do exactly one thing: read the repo.
   The gates never needed write access, so this shrinks the blast radius of a
   compromised action to zero writes.
2. **Concurrency with cancel-in-progress** — `group: ci-${{ github.ref }}`.
   A new push to the same branch cancels the superseded run instead of letting
   both run to completion. Fewer wasted runner minutes, same final signal.
3. **`workflow_dispatch` trigger** — the full gate suite can now be re-run on
   demand from the Actions tab (any branch) without pushing an empty commit.
4. **Bundle report in the run summary** — the Performance Budget step now runs
   as `set -o pipefail && npm run check:bundle | tee "$GITHUB_STEP_SUMMARY"`.
   Same script, same gate, same exit code — but the per-file gzip table and the
   total now render in the Actions summary page, so the bundle number is
   visible without opening the raw log. `pipefail` guarantees the budget
   failure still fails the step.

## 2. Verification

- YAML parsed locally (`yaml.safe_load`) before push.
- Full local gate suite on the branch, Node 24 / npm 11 sandbox:
  `lint` ✓ · `typecheck` ✓ · `test` 42 files / **389 passed** ✓ · `build` ✓
  (PWA precache clean) · `check:bundle` **142.95 / 300 KB** ✓.
- The runtime gates are unchanged, so CI's own run on the PR is the
  authoritative confirmation (green → squash-merged).

## 3. Owner actions

**None.** Nothing to deploy, no migration, no secrets.

## 4. Rollback

Single-file revert: `git revert` of the squash commit restores the previous
29-line workflow verbatim.
