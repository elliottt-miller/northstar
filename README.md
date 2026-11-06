# NorthStar Gap Tool

NorthStar Gap Tool is a browser-based advisor application for illustrating Life, Disability, Unemployment, and Liability risk gaps. Financial results are illustrative and depend on the inputs and assumptions entered.

## Application flow

```text
Client profile → scenario inputs → typed calculation functions → shared schedules and metrics → charts and presentation
```

The React application is organized by feature under `src/features/risk-modules/`. Pure calculations live in each module's `calculations/` folder. Shared financial math, assumptions, formula descriptions, and gap-schedule helpers live under `src/domain/`. Zustand stores scenario data in the browser's local storage; the repository has no server API, authentication, or multi-user storage.

## Run and verify

Use Node.js 20 and npm with the committed lockfile.

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

`npm test` runs the formula, profile exchange, shared-income synchronization, and number-input checks. `npm run build` type-checks and builds both the GitHub Pages site in `docs/` and the NorthStar application bundle in `dist/`.

## Source and generated files

- `src/` contains application code and is the source of truth for runtime behavior.
- `project-docs/` contains product, technical, and advisor reference material. `project-docs/advisor-references/` is reserved for unique advisor methodology and source documents.
- `docs/` is the checked-in GitHub Pages build output. Regenerate it with `npm run build:pages`; do not hand-edit hashed assets.
- `public/` contains static assets copied into builds.
- `.env.github-pages` and `.env.northstar` set public Vite base paths only. Do not put credentials or private client data in the repository.

When documentation and implementation disagree, confirm the current advisor requirement before changing a financial formula. Keep each financial rule in one calculation path and derive cards, charts, scenarios, and presentation summaries from that result wherever their scope is the same.

## Data handling

This static application stores client and scenario records in the current browser profile. It does not provide server-side access control, encrypted persistence, or synchronization. Use synthetic data in public examples and do not enter identifiable client information on a shared or publicly accessible browser.

## Deployment

`npm run deploy` invokes `deploy-pages.ps1`, which builds `docs/`, commits generated files, and pushes the current deployment to `main`. Review the working tree and branch before running it. Pull requests are validated by GitHub Actions but do not deploy the site.
