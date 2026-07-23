# RobAI-Club CMS authentication service

This small Cloudflare Worker completes GitHub OAuth for the Decap CMS page at `/admin/`. It never stores passwords or access tokens. Signed, short-lived OAuth state prevents callback tampering, and only the configured site hostname is accepted.

## One-time owner setup

1. Create a GitHub OAuth App under **GitHub → Settings → Developer settings → OAuth Apps**.
   - Homepage URL: `https://logancome.github.io/robailab.github.io/`
   - Authorization callback URL: `https://YOUR-WORKER.workers.dev/callback`
2. In this directory, authenticate Wrangler and deploy:

   ```text
   npx wrangler login
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put STATE_SECRET
   npx wrangler deploy
   ```

   `STATE_SECRET` must be a new random value of at least 32 characters.
3. Replace `https://REPLACE-WITH-YOUR-WORKER.workers.dev` in `static/admin/config.yml` with the exact Worker origin printed by Wrangler.
4. Commit, build, and deploy the Hugo site. Visit `/admin/` and sign in with a GitHub account that has access to the repository.

Only GitHub collaborators with suitable repository permission can save content. The CMS uses editorial workflow, so changes are placed in a review queue before publication.
