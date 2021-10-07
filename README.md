# TypeScript Error Reporter Action ![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/gozala/typescript-error-reporter-action) ![GitHub](https://img.shields.io/github/license/gozala/typescript-error-reporter-action)

Ensuring type safety is one of the most important responsibilities of modern software developers.

This action uses the [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) to run a static type check on your code and display the results of the check.

![TypeScript Error Reporter Action](https://user-images.githubusercontent.com/8381075/78413929-a40f0680-7654-11ea-8365-0ef72fb4d6b3.png)

## Example Configuration

`.github/workflows/test.yml`:

```yaml
name: Test

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [13.x]
    steps:
      - uses: actions/checkout@v1
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v1
        with:
          node-version: ${{ matrix.node-version }}
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Typecheck
        uses: computerjazz/typescript-error-reporter-action@v1.0.11
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es5",
    "module": "commonjs",
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "types": ["node"],
    "lib": ["ES2017"]
  },
  "include": ["src/**/*.ts"]
}
```

## Passing `project` parameter

If you're working with a monorepo or your `tsconfig.json` is not in the root repo,
or you use different config file, you can provide a `project` parmeter with a
path to the repo itself:

```yaml
- name: Typecheck
  uses: computerjazz/typescript-error-reporter-action@v1.0.11
  with:
    project: packages/subpackage/tsconfig.json
```
## Passing `error_fail_threshold` parameter

If you're incrementally adopting typescript in a project, you may not want to fail the entire workflow on a single typescript error. `error_fail_threshold` allows you to pass the maximum number of errors at which the step passes. Defaults to 0:

```yaml
- name: Typecheck
  uses: computerjazz/typescript-error-reporter-action@v1.0.11
  with:
    error_fail_threshold: 100
```

## passing `repo_token` parameter

In order to bypass the maximum of 10 pull request annotations that a GitHub action can post, this action uploads all annotations in separate, batched api calls, which requires an API token:

```yaml
- name: Typecheck
  uses: computerjazz/typescript-error-reporter-action@v1.0.11
  with:
    error_fail_threshold: 100
    repo_token: "${{ secrets.GITHUB_TOKEN }}"
```
