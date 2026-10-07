# Patch sync workflow

Three workflows run the patch-update pipeline. They share secrets and variables with the existing deploy setup.

| Workflow | File | Trigger | Result |
| --- | --- | --- | --- |
| Sync Patch Data | `.github/workflows/sync-data.yml` | manual (`workflow_dispatch`) | runs `data:update` + `counters:update` + `icons:cache`, opens a PR |
| Release on Merge | `.github/workflows/release-on-merge.yml` | PR merged into `main` | tags the commit, creates a GitHub Release |
| Rollback Cloudflare Pages | `.github/workflows/rollback-pages.yml` | manual (`workflow_dispatch`) | rolls back the production deployment via CF API |

## What `Sync Patch Data` does

1. `pnpm run data:update` — auto-detects the latest patch label from `https://mlbbhub.com/statistics` (scrapes `"Patch X.Y.Z"` from the embedded RSC payload). Falls back to the previous run's `data/heroes.json[0].patch`, then to `'2.1.95a'`. Override by passing the `patch` workflow input. Default skips rewrite when patch unchanged + no new heroes (kills daily drift PR spam); set `force: true` input (`pnpm data:update -- --force` locally) to force meta refresh.
2. `pnpm run counters:update` — refreshes counter pairs.
3. `pnpm run icons:cache` — caches new hero icons.
4. Lint + test.
5. Bumps `package.json` version to the detected patch label (toggle via `bump_app_version` input).
6. Prepends a section to `CHANGELOG.md`.
7. Opens a PR titled `🔄 Sync patch <label>` with the `patch-sync` + `auto-update` labels.
8. Merge the PR — `Release on Merge` tags and releases, `Deploy to Cloudflare Pages` deploys to production.

If `data:update` finds no new patch (output identical to `main`), the workflow exits without opening a PR.

## Required GitHub values

| Name | Type | Where | Used by | Required? |
| --- | --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | Settings → Secrets and variables → Actions → Secrets | rollback-pages.yml, deploy-cloudflare.yml | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | same | rollback-pages.yml, deploy-cloudflare.yml | Yes |
| `PAGES_PROJECT` | Variable | Settings → Secrets and variables → Actions → Variables | rollback-pages.yml, deploy-cloudflare.yml | Yes (default `mlbb-draft-coach`) |
| `GOOGLE_SITE_VERIFICATION` | Variable | Settings → Environments → `cf` → Variables | deploy-cloudflare.yml | No (only for custom-domain GSC) |
| `PATCH_API_TOKEN` | Secret | Settings → Secrets and variables → Actions → Secrets | sync-data.yml (passed as `PATCH_LABEL` to script) | No (only if mlbbhub ever needs auth) |
| `GITHUB_TOKEN` | Secret | auto-injected | all workflows | Yes (built-in) |

All secrets should be ✅ Masked and ✅ Protected.

## Existing values

`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `PAGES_PROJECT` are already set up for `deploy-cloudflare.yml` and reused by `rollback-pages.yml`. You do not need to recreate them.

If they don't exist on your fork, the section below shows how to obtain each one.

## Getting `CLOUDFLARE_API_TOKEN`

1. Open <https://dash.cloudflare.com/profile/api-tokens>.
2. Click **Create Token** → **Create Custom Token** (not a template).
3. Permissions:
   - Account → **Cloudflare Pages: Edit**
4. Account Resources: **Include → Your account**.
5. (Optional) TTL: set an expiry date.
6. Click **Continue to summary → Create Token**.
7. Copy the token (shown once).

Add to GitHub:

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab.
2. **New repository secret**:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: paste the token
3. ✅ Masked, ✅ Protected.

Verify:

```bash
gh secret list
# CLOUDFLARE_API_TOKEN   Updated YYYY-MM-DD
```

## Getting `CLOUDFLARE_ACCOUNT_ID`

1. Open <https://dash.cloudflare.com/>.
2. Click **Workers & Pages** in the left sidebar.
3. Look at the right sidebar — bottom shows **Account ID** (32-char hex).

Add to GitHub as a secret named `CLOUDFLARE_ACCOUNT_ID` (same place as the token, ✅ Masked, ✅ Protected).

Verify:

```bash
gh secret list
# CLOUDFLARE_ACCOUNT_ID  Updated YYYY-MM-DD
```

## Getting `PAGES_PROJECT`

The Pages project name is a free-form string, not a Cloudflare API value. It must match the project you created in Cloudflare.

1. <https://dash.cloudflare.com/> → **Workers & Pages**.
2. Click your Pages project.
3. The project name appears at the top of the page (used in the URL slug, e.g. `https://dash.cloudflare.com/.../pages/view/<name>`).
4. For this repo: `mlbb-draft-coach`.

Add to GitHub as a **Variable** (not a secret — it is not sensitive):

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.
2. **New repository variable**:
   - Name: `PAGES_PROJECT`
   - Value: `mlbb-draft-coach`

The workflow defaults to `mlbb-draft-coach` if the variable is unset (`vars.PAGES_PROJECT || 'mlbb-draft-coach'`).

Verify:

```bash
gh variable list
# PAGES_PROJECT   mlbb-draft-coach
```

## Getting `GOOGLE_SITE_VERIFICATION` (optional)

Only needed if you have a custom domain on Cloudflare Pages and want Google Search Console ownership verification.

1. Google Search Console → your property → **Settings** → **Ownership verification** → **HTML tag**.
2. Copy the `content="..."` value.
3. GitHub → **Settings** → **Environments** → **cf** → **Variables** (not at repo level — it lives on the `cf` environment).
4. Add `GOOGLE_SITE_VERIFICATION` with that value.

Vite reads `process.env.GOOGLE_SITE_VERIFICATION` at build time and injects the meta tag into `index.html`.

## Getting `PATCH_API_TOKEN` (usually not needed)

The data scripts call `https://mlbbhub.com/api/stats` and `https://mlbbhub.com/statistics` without authentication today (verified — bot UA and full browser UA both return identical bodies).

If mlbbhub ever requires auth:

1. Register as a developer on the upstream source and obtain a token.
2. Add to GitHub as a secret named `PATCH_API_TOKEN` (✅ Masked, ✅ Protected).
3. The workflow exposes it to scripts via `env: PATCH_API_TOKEN: ${{ secrets.PATCH_API_TOKEN }}`. Update the script's `fetchWithUA` call to include `Authorization: Bearer ${PATCH_API_TOKEN}` if needed.

If you have not been given a token, skip this step. The script ignores unset env vars.

## Backend services referenced (read-only — no setup needed)

These are upstream data sources, not services you run:

| URL | Used by | Purpose |
| --- | --- | --- |
| `https://mlbbhub.com/api/stats` | `data:update` | hero win/pick/ban rates and tiers |
| `https://mlbbhub.com/statistics` | `data:update` (auto-detect) | scrape latest patch label |
| `https://mlbbhub.com/heroes/<slug>` | `data:update` | scrape hero name/role/lane/icon for new heroes |
| `https://mlbbhub.com/counter/<slug>` | `counters:update` | scrape counter pair data |
| `https://wsrv.nl/` | `icons:cache` | image proxy for hero icons |

## First run

```bash
# 1. Verify secrets
gh secret list
# Expected: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN

# 2. Verify variables
gh variable list
# Expected: PAGES_PROJECT, GOOGLE_SITE_VERIFICATION

# 3. Trigger sync (patch auto-detected; override with -f patch=2.1.96)
gh workflow run sync-data.yml

# 4. Open the Actions tab and verify a PR was opened.
# 5. Review the PR (data diff, version bump, changelog entry).
# 6. Merge the PR.
#    - Release on Merge: tags the commit + creates a GitHub Release.
#    - Deploy to Cloudflare Pages: builds and deploys to production.
# 7. Test rollback (only if prod has issues):
gh workflow run rollback-pages.yml -f reason="counters broken in latest deploy"
```

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN is empty` | Secret missing | Add per "Getting `CLOUDFLARE_API_TOKEN`" above |
| `Token needs Account -> Cloudflare Pages -> Edit` | Token lacks Pages permission | Recreate token with correct scope |
| `Rollback HTTP 400` | Deployment ID invalid or already-rolled-back target | Pick a different `target_deployment` |
| Script: `ReferenceError: tierScore is not defined` | Old script version | Run `pnpm run lint` and pull latest; import was added in current version |
| Workflow exits without opening PR | No new patch data (output identical to `main`) | Expected; nothing to sync |
| PR bot fails to push branch | Branch protection blocks `contents: write` | Admin must allow bot pushes or open MR manually |
