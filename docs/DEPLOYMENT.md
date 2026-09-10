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

### 3. Find your account ID

Cloudflare dashboard -> Workers & Pages -> Overview. The Account ID is in the
right sidebar. (With no zone in the account, the Workers & Pages overview is the
easiest place to read it.)

### 4. Add two repository secrets

GitHub -> repo -> Settings -> Secrets and variables -> Actions -> New repository secret:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | the ID from step 3 |

Never commit these values. The workflow reads them from `secrets.*` only.

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
wrangler pages deploy dist \
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

## Maintenance

- Versions are pinned on purpose: `pnpm 12.3.4` and Node 24 in `package.json`,
  wrangler `4.131.0` in the docs, `pnpm/setup@v2.1.0` and
  `cloudflare/wrangler-action@v4.0.0` by commit SHA in the workflows. Bump them
  deliberately, not by accident.
- `actions/*` use tags because GitHub owns those repositories; everything
  third-party is pinned to a full commit SHA, since a tag can be moved.
- To require human approval before a production deploy, add a required reviewer
  to an environment and reference it from the `production` job:
  Settings -> Environments.
- `pnpm/setup@v2` installs pnpm 11+ only. If you ever pin pnpm back to 10 or
  older, switch both workflows to `pnpm/action-setup@v6` plus
  `actions/setup-node`, because the successor action does not support pnpm 10.
