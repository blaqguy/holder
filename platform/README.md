# Dragonfly Platform

## About

This is the monorepo for the DragonflyFT UOB Cloud product. It is currently maintained by Emeka Nnaji (Emeka.Nnaji@dragonflyft.com), Jacob Laverty (Jake.Laverty@dragonflyft.com), Darby Kidwell (Darby.Kidwell@dragonflyft.com), Gavin Dale (Gavin.Dale@dragonflyft.com), and Fernando Hudson (Fernando.Hudson@dragonflyft.com)

## Getting Started

#### Installing AWS CLI, Terraform

- Install AWS

```
https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
```

- Install Terraform ENV

```
brew install tfenv
```

- Install Terraform

```
tfenv install 1.2.9
```

#### Installing Node / NVM

- Install NVM

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
```

- Use NVM to install latest Node

```
nvm install node
```

- Update npm

```
npm install -g npm@latest
```

- Install nx globally (for convenience)

```
npm install -g nx
```

- Install platform dependencies

```
<from inside this project's root dir. The same place as this README> npm install
```

#### Installing CDK TF CLI

- Install CLI globally

```
npm install -g cdktf-cli@latest
```

### Setting up environment variables

- Create the required variable

- Linux:

```
export DRAGONFLY_DEVELOPMENT_PREFIX=<YOUR INITIALS>
```

- Windows:

```
set DRAGONFLY_DEVELOPMENT_PREFIX=<YOUR INITIALS>
```

### Configuring git flow

We use the gitflow workflow as our branching strategy. The git-flow CLI tool helps facilitate the branching and release process.

https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow
https://github.com/nvie/gitflow

#### Install git-flow

For mac: `brew install git-flow`
For linux (WSL): `apt-get install git-flow`

#### Configure the CLI

- Run `git flow init`
- Accept all defaults by hitting enter without typing anything

```
$ git flow init

Initialized empty Git repository in ~/project/.git/
No branches exist yet. Base branches must be created now.
Branch name for production releases: [master]
Branch name for "next release" development: [develop]

How to name your supporting branch prefixes?
Feature branches? [feature/]
Release branches? [release/]
Hotfix branches? [hotfix/]
Support branches? [support/]
Version tag prefix? []
```

#### Creating a feature branch

- run `git flow feature start <branch-name>`

```
$ ~/projects/platform % git flow feature start git-flow-readme
M	README.md
Switched to a new branch 'feature/git-flow-readme'

Summary of actions:
- A new branch 'feature/git-flow-readme' was created, based on 'develop'
- You are now on branch 'feature/git-flow-readme'

Now, start committing on your feature. When done, use:

     git flow feature finish git-flow-readme
```

### How to use SOPS (Secrets OPerationS)

Ensure you have sops installed, you can download it from here: https://github.com/mozilla/sops

- To edit secrets file, from the root of the platform directory:-run:

```bash
sops secrets.sops.json
```

- To just view the decrypted secrets file within your terminal:-run sops command with decrypt flag.

```bash
sops -d secrets.sops.json
```
