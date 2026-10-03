# Git setup for the main RepairLedger project

The main working copy is `D:\B2B\RepairLedger-Web-and-Mobile-Final\RepairLedger-app-source`. It is one Git repository containing the web app, mobile app and shared backend, with an initial `main` branch. Other source copies and your global work Git configuration are unchanged.

## Commit identity

This checkout's local `.git/config` uses `dharundarsan@gmail.com` for new author/committer identities and preserves your existing display name. Git settings apply when you run Git from the root or its application subfolders. Explicit `--author` options and Git identity environment variables can still override defaults; existing commit authors are not rewritten.

Check from the root:

```powershell
git config --show-origin --get user.email
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
git config --global --get user.email
```

The first three commands should show your personal identity for this checkout. The last command should still show your existing work email. These local settings are not source files: moving this repository with its `.git` directory preserves them, but a new clone needs its own local configuration.

GitHub associates commits with an account through an email belonging to that account. Ensure your requested email is verified on your personal GitHub account; changing commit email does not log Git into GitHub. See [GitHub's commit-email guide](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).

## Push authentication

The personal GitHub username and repository URL are still needed to finish the remote/account selection. No remote has been invented, no GitHub repository has been created, and no code has been pushed.

The checkout has `credential.namespace=repairledger-personal` and `credential.https://github.com.useHttpPath=true`. These settings apply here only, keeping its GCM credential lookup separate from the default work namespace. They are not a completed personal-account login. Once the correct GitHub login is known, a repository-local `credential.https://github.com.username` can select it; configure `origin` only with your actual repository URL. Sign in to the personal account when Git first requests authentication. Do not paste a token into a remote URL, source file or chat.

GitHub CLI currently remains signed into the existing work account. Do not use `gh repo create`, `gh auth switch`, or an editor's **Publish to GitHub** action assuming this commit email changes its signed-in account. Those clients have their own account selection. Ordinary `git push` over HTTPS uses the repository's Git/GCM settings. See [GCM's multiple-account guide](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/multiple-users.md).

## Review before the first push

```powershell
git status --short
git ls-files --others --exclude-standard
git remote -v
```

Review the files before staging or committing. The ignore rules exclude dependency/build folders, private environment files, private application settings, local databases, credential files and generated TypeScript artifacts. Configuration examples and public application defaults remain available. Ignore rules are a safeguard, not a secret scanner; review configuration/source changes yourself and never force-add secrets.

No files have been staged or committed automatically. Production readiness limitations remain in [the final handoff guide](../FINAL-HANDOFF.md).
