# Action Deployment Manifest

This git action maintains a deployment manifest of the matrix of environments, deployables,
versions, and statuses

## Commands

### `getDeployableList`

Returns the deployables (and the version of each) to deploy.

| Input         | Description                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`     | A version (starts with `#.#.#`): every non-rejected deployable recorded at that version. Anything else is treated as an env: every deployable deployed to that env. |
| `fallbackEnv` | Optional. An **env name** (e.g. `qa`), not a version. Every deployable with nothing at `version` is taken at the version currently deployed to this env. See below. |
| `deployables` | Optional comma-separated list that limits the result to those names.                                                                                                |

Outputs: `deployables` (JSON array of `{ deployable, version }`), `deployablesFull`,
`deployablesPrettyString` and `hasDeployables`.

#### Bringing an env up to date with `fallbackEnv`

When only the changed deployables were built at `version`, pass the env the rest should come from:

```yaml
- uses: dkhunt27/action-deployment-manifest@v3
  id: getDeployableList
  with:
    command: getDeployableList
    version: 2026.11.13-1
    fallbackEnv: qa
    actor: ${{ github.actor }}
    deployableTable: my-deployable-table
    deployedTable: my-deployed-table
```

- A deployable recorded at `version` always uses `version`, even if `qa` runs something else.
- Every other deployable deployed to `qa` is added at the version `qa` runs. These are not
  re-checked against the deployable table.
- With `deployables` set, each name uses `version` if it exists there, otherwise the version
  deployed to `qa`; a name found in neither is skipped with a warning.
- If `qa` has no deployed records, a warning is logged and only the `version` results are returned.
- A `fallbackEnv` that looks like a version (contains a `.`) fails the step.

Items in `deployables` now carry different versions, so deploy each one at its own
`matrix.deployableItem.version`. `deployablesPrettyString` lists each item as `name@version`,
marking those taken from the fallback env:

```text
[
  servicing-api@2026.11.01-3 (from qa),
  web@2026.11.13-1
]
```

Without `fallbackEnv`, all outputs are unchanged.

### `markDeployed`

Records each deployable in `deployables` as deployed to `env` at `version`, then updates its status
in the deployable table:

- `deployedToProd: true`: the current `rollback` version becomes `decommissioned`, the current
  `prod` version becomes `rollback`, and `version` becomes `prod`.
- Otherwise `version` becomes `pending`, but only if it is still `available`. A version that has
  already reached `prod` (or is `rollback`, `decommissioned` or `rejected`) keeps its status, so
  redeploying it to another env does not break the prod/rollback chain.

The step fails before writing anything if `version` has no record for a deployable in the deployable
table.

## Upgrading from v2 to v3

- `getDeployableList` has a new optional `fallbackEnv` input (see above). Without it, outputs are
  unchanged.
- `markDeployed` now fails, before writing anything, when a deployable has no record at `version`.
  In v2 this check ran but was not awaited, so a missing record either went unnoticed or crashed the
  step part-way through.
- A non-prod `markDeployed` no longer changes a `prod`, `rollback`, `decommissioned` or `rejected`
  version to `pending`.

## Testing

Need to install [aws cli](https://docs.aws.amazon.com/cli/v1/userguide/install-macos.html) and
[localstack](https://app.localstack.cloud/getting-started) to test dynamodb commands locally. Start
localstack and create the tables

```bash
   brew install awscli
   brew install localstack/tap/localstack-cli
   localstack auth set-token [see localstack getting started for token]

   ./localstack-init.sh
```

## Test your action locally

The [`@github/local-action`](https://github.com/github/local-action) utility can be used to test
your action locally. It is a simple command-line tool that "stubs" (or simulates) the GitHub Actions
Toolkit. This way, you can run your TypeScript action locally without having to commit and push your
changes to a repository.

The `local-action` utility can be run in the following ways:

- Visual Studio Code Debugger

  Make sure to review and, if needed, update [`.vscode/launch.json`](./.vscode/launch.json)

- Terminal/Command Prompt

  ```bash
  # npx @github/local action <action-yaml-path> <entrypoint> <dotenv-file>
  npx @github/local-action . src/main.ts .env
  ```

You can provide a `.env` file to the `local-action` CLI to set environment variables used by the
GitHub Actions Toolkit. For example, setting inputs and event payload data used by your action. For
more information, see the example file, [`.env.example`](./.env.example), and the
[GitHub Actions Documentation](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).

## Publishing a New Release

This project includes a helper script, [`script/release`](./script/release) designed to streamline
the process of tagging and pushing new releases for GitHub Actions.

GitHub Actions allows users to select a specific version of the action to use, based on release
tags. This script simplifies this process by performing the following steps:

1. **Retrieving the latest release tag:** The script starts by fetching the most recent SemVer
   release tag of the current branch, by looking at the local data available in your repository.
1. **Prompting for a new release tag:** The user is then prompted to enter a new release tag. To
   assist with this, the script displays the tag retrieved in the previous step, and validates the
   format of the inputted tag (vX.X.X). The user is also reminded to update the version field in
   package.json.
1. **Tagging the new release:** The script then tags a new release and syncs the separate major tag
   (e.g. v1, v2) with the new release tag (e.g. v1.0.0, v2.1.2). When the user is creating a new
   major release, the script auto-detects this and creates a `releases/v#` branch for the previous
   major version.
1. **Pushing changes to remote:** Finally, the script pushes the necessary commits, tags and
   branches to the remote repository. From here, you will need to create a new release in GitHub so
   users can easily reference the new tags in their workflows.

## Troubleshooting

### SyntaxError: Cannot use import statement outside a module

if you get the error `SyntaxError: Cannot use import statement outside a module` when trying to run
test in vscode, you will need to enable the jest options in package.json in vscode. Set
`Jestrunner: Jest Command` to `NODE_OPTIONS=--experimental-vm-modules NODE_NO_WARNINGS=1 npx jest`
