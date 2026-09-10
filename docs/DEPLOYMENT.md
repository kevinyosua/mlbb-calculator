# Deploy to Cloudflare Pages

This repository ships a static Vite build to Cloudflare Pages. Two workflows do it:

| Workflow | File | Trigger | Result |
| --- | --- | --- | --- |
| CI | `.github/workflows/ci.yml` | push to `main`, every PR | lint, test, build, upload `dist` |
| Deploy to Cloudflare Pages | `.github/workflows/deploy-cloudflare.yml` | push to `main`, same-repo PR, manual | production or preview deploy |

There are two ways to connect this repo to Cloudflare Pages. Pick one.

## Option A: Cloudflare Pages Git integration (no workflow needed)

Cloudflare can watch the GitHub repo itself.

1. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
2. Pick `kevinyosua/mlbb-draft-coach`.
3. Set the build options:

   | Setting | Value |
   | --- | --- |
   | Framework preset | None (or Vite) |
   | Build command | `pnpm run build` |
   | Build output directory | `dist` |

4. Every push to the production branch goes live, every other branch gets a
   preview URL.

Cloudflare reads `packageManager` from `package.json`, so it uses pnpm 12.3.4
without extra configuration. A `pnpm-lock.yaml` at the repo root is all it needs.

Done. The workflows below are for when you want GitHub Actions to own the
pipeline.

## Option B: Deploy from GitHub Actions

### 1. Create the Pages project

Once, on your machine:

```sh
pnpm dlx wrangler@4.131.0 login
pnpm dlx wrangler@4.131.0 pages project create mlbb-draft-coach --production-branch=main
```

`--production-branch=main` matters. The workflow passes `--branch=main` for
production deploys, and Cloudflare only treats an upload as production when the
branch matches this setting.

If you use Option A instead, the project is created for you — just make sure its
production branch is `main` in Settings -> Builds & deployments.

### 2. Create an API token

Cloudflare dashboard -> My Profile -> API Tokens -> Create Token -> Custom token.

- **Permissions:** Account -> Cloudflare Pages -> Edit
- **Account Resources:** include your account

Scope it to the one account and give it an expiry date. It does not need any
Zone-level permission.

Do **not** use the built-in "Edit Cloudflare Workers" template. It grants
Workers permissions, not Pages ones, so `wrangler pages deploy` fails with an
authentication error even though `wrangler whoami` may still look fine. The
token has to be a custom token that includes Cloudflare Pages -> Edit.

### 3. Find your account ID

Cloudflare dashboard -> Workers & Pages -> Overview. The Account ID is in the
right sidebar. (With no zone in the account, the Workers & Pages overview is the
easiest place to read it.)

### 4. Add the two secrets

GitHub -> repo -> Settings -> Secrets and variables -> Actions.

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | the ID from step 3 |

Never commit these values. The workflow reads them from `secrets.*` only.

There are two places they can live, and this repo uses the second one.

**Repository secrets** (the "Repository secrets" box): readable by every job in
the repo. The simplest option.

**Environment secrets** (the "Environment secrets" box), inside an environment
named `cf`. This is how the repo is set up, so both deploy jobs declare
`environment: cf`. An environment secret is readable **only** by a job that
names its environment. Everywhere else it resolves to an empty string and the
deploy dies with:

```
In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN
environment variable for wrangler to work.
```

So if you rename that environment, change `environment:` on the `preview` and
`production` jobs in
[`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) to match.

Do not put them in the **Variables** tab: those are plain text, and no secret
name resolves from there. If the same name exists both at repository and at
environment level, the environment value wins.

The `Verify credentials and project` step catches all of this before the upload
and says which secret is missing.

### 5. Set the project name

This value is **not** detected automatically — wrangler resolves it from
`--project-name` or from a `name` field in a Wrangler config file, and this repo
has neither. It must match the Pages project you created in step 1, otherwise the
deploy fails with:

```
The Pages project "mlbb-draft-coach" does not exist.
```

Wrangler will not create the project for you in CI. It only offers to create it
when a human runs it in a terminal. So create it first (step 1).

There are two ways to set the name, pick one.

**Repository variable** — no file edit needed:

GitHub -> Settings -> Secrets and variables -> Actions -> Variables -> New
repository variable, name `PAGES_PROJECT`. The workflow reads it and falls back
to `mlbb-draft-coach` when it is unset.

**Edit the workflow** — change the fallback in
`.github/workflows/deploy-cloudflare.yml`:

```yaml
env:
  PAGES_PROJECT: ${{ vars.PAGES_PROJECT || 'mlbb-draft-coach' }}
```

The project name is independent of the GitHub repo name. Cloudflare's Git
integration (Option A) does default it to the repo name, which is why
`mlbb-draft-coach` is the fallback here.

### 6. Push

```sh
git add .github/workflows .gitignore package.json docs/DEPLOYMENT.md
git commit -m "ci: deploy to Cloudflare Pages"
git push
```

A push to `main` runs CI, then a production deploy. A PR from a branch in this
repo runs CI, then a preview deploy. The deployment URL is written to the job
summary, and because the workflow passes `gitHubToken`, the deploy also shows up
on the commit as a GitHub Deployment.

You can also run the deploy workflow by hand from the Actions tab and choose
`preview` or `production`.

## How the deploy steps work

```sh
pnpm run build                                   # Vite writes dist/
pnpm exec wrangler pages deploy dist \
  --project-name=mlbb-draft-coach \
  --branch=main                                  # must match production branch
```

The build happens on the GitHub runner, so Cloudflare only receives finished
static files. No build minutes are spent on Cloudflare's side.

Preview deploys use `--branch=pr-<number>`, which gives each PR a stable alias at
`https://pr-<number>.mlbb-draft-coach.pages.dev`. Re-running the workflow for the
same PR updates that same alias instead of piling up new URLs.

## Optional: _headers and _redirects

Cloudflare Pages reads two plain files from the build output. Drop them in
`public/` and Vite copies them into `dist/` unchanged.

`public/_headers` — security headers:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
```

`public/_redirects` — needed for client-side routing. Without it a deep link
like `/draft/123` returns a 404 because no such file exists. This app is a
single view today, so you do not need it yet:

```
/*  /index.html  200
```

## Does this need wrangler.toml?

No. `wrangler pages deploy` takes everything it needs as flags, and Pages
projects are not configured from `wrangler.toml` the way Workers are. Adding one
would only risk Cloudflare mistaking this for a Workers project.

## Why pnpm-workspace.yaml exists

The repo has no workspace packages. The file is there for one setting:

```yaml
allowBuilds:
  esbuild: true
  workerd: true
```

pnpm 12 does not run a dependency's build scripts unless the package is approved
here, and a skipped script is a hard error, not a warning. `wrangler` is a
devDependency of this app, and it pulls in both packages, so without this the
job died on:

```
ERR_PNPM_IGNORED_BUILDS
  Ignored build scripts: esbuild@0.28.1, workerd@1.20260908.1
```

Both need their `postinstall`: each ships its platform binary outside the npm
tarball and downloads it there. Neither is used by the app at runtime; they are
there only because the wrangler CLI bundles them.

Deleting this file will break the deploy job. So will removing either entry.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN` | The secret resolved to an empty string: it does not exist, is named differently, sits in the Variables tab, or is an environment secret in an environment the job does not name. |
| `You are not authenticated` | The token was sent but Cloudflare rejected it: wrong value, revoked, or expired. |
| `ERR_PNPM_IGNORED_BUILDS` | A build script was not approved. Add the package to `allowBuilds` in `pnpm-workspace.yaml`. |
| `The Pages project "x" does not exist.` | Project name mismatch. See step 5. Wrangler never creates the project for you in CI. |
| `Authentication error` / `Unable to authenticate` | `CLOUDFLARE_API_TOKEN` is missing, expired, or lacks Account -> Cloudflare Pages -> Edit. |
| A push to `main` produced a preview URL | The Pages project's production branch is not `main`, so `--branch=main` did not match it. |
| `Could not resolve to a Repository` | Fork PR. Deploys are skipped for forks by design, since they get no secrets. |

## Maintenance

- Versions are pinned on purpose: `pnpm 12.3.4`, Node 24 and wrangler `4.131.0`
  in `package.json`, and `pnpm/setup@v2.1.0` by commit SHA in the workflows.
  Bump them deliberately, not by accident.
- `actions/*` use tags because GitHub owns those repositories; everything
  third-party is pinned to a full commit SHA, since a tag can be moved.
- To require human approval before a production deploy, add a required reviewer
  to the `cf` environment (Settings -> Environments). Both deploy jobs already
  reference it. Be aware that a job cannot read environment secrets until a
  reviewer approves, so this also gates the preview deploy; split preview and
  production into two environments if you only want to gate production.
- `pnpm/setup@v2` installs pnpm 11+ only. If you ever pin pnpm back to 10 or
  older, switch both workflows to `pnpm/action-setup@v6` plus
  `actions/setup-node`, because the successor action does not support pnpm 10.
- Keep the `wrangler` devDependency and the `wrangler@4.131.0` references in
  this document in step. Bumping one without the other makes the docs describe a
  version nothing runs.
- The deploy workflow calls `pnpm exec wrangler` directly instead of using
  `cloudflare/wrangler-action`. The action runs wrangler internally and, when it
  fails, reports only `The process '.../pnpm' failed with exit code 1`, hiding
  wrangler's own error message. Calling wrangler directly puts the real error in
  the log.
- The "Verify credentials and project" step gate is there because
  `wrangler whoami` **exits 0 even when it is not authenticated**, so it cannot
  be used as a check. The step queries the Pages API instead: HTTP 200 proves the
  token is valid, has Pages access, and that the project exists, all before any
  upload starts.
