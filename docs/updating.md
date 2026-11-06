# Getting updates

**If you installed with a fork** (the steps in [install.md](install.md)):
1. Open your fork on GitHub (`github.com/yourname/tcf-prep`).
2. If it says "This branch is … commits behind", click **Sync fork → Update branch**.
3. Vercel sees the change and deploys it within about a minute. Your data is not touched: it lives in your database.

**If you used the Deploy button:** your repository is a copy, not a fork, so GitHub has no Sync button. Pull the
changes with git (or ask an AI assistant with a terminal to do it for you):
```bash
git remote add upstream https://github.com/arturramosc99/tcf-prep.git
git pull upstream main
git push
```

Database changes run by themselves when the new version starts; you never need to run migrations.
