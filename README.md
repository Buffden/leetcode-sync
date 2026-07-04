<p align="center">
    <img src="images/leetcode_sync.png" width="250"/>
</p>

# LeetCode Sync

GitHub Action for automatically syncing LeetCode submissions to a GitHub repository, organized by DSA pattern.

## Features

- **DSA pattern folders**: solutions are organized by algorithmic pattern (e.g. `sliding-window/`, `dynamic-programming/`) using a priority-ordered tag map
- **Per-problem README**: each problem gets its own `README.md` with title, difficulty, link, topics, runtime/memory stats, and placeholder `## Approach` / `## Complexity` sections
- **Multi-language support**: solution files use the correct extension per language (e.g. `two-sum-solution.java`, `two-sum-solution.cpp`)
- **Commit message format**: `[LeetCode] <number>. <title>` (e.g. `[LeetCode] 1. Two Sum`)
- **Fallback folder**: problems with no matching pattern tag go into `uncategorized/`

## Folder structure

```
<destination-folder>/
└── <dsa-pattern>/
    └── <number>-<problem-slug>/
        ├── README.md
        └── <problem-slug>-solution.<ext>
```

Example:
```
sliding-window/
└── 0076-minimum-window-substring/
    ├── README.md
    └── minimum-window-substring-solution.java
dynamic-programming/
└── 0070-climbing-stairs/
    ├── README.md
    └── climbing-stairs-solution.java
```

## How to use

1. Login to LeetCode and obtain the `csrftoken` and `LEETCODE_SESSION` cookie values.

   - After logging in, open DevTools → Application → Cookies → `https://leetcode.com`
   - Copy the values for `csrftoken` and `LEETCODE_SESSION`

2. Create a new GitHub repository to host your LeetCode solutions.

3. Add the values from step 1 as [GitHub secrets](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets-for-a-repository) in your solutions repo:
   - `LEETCODE_CSRF_TOKEN`
   - `LEETCODE_SESSION`

4. Go to your solutions repo → Settings → Actions → Workflow Permissions → enable **Read and Write** permissions.

5. Add a workflow file under `.github/workflows/`, e.g. `sync-leetcode.yml`:

   ```yaml
   name: Sync LeetCode Solutions

   on:
     schedule:
       - cron: '0 0,6,12,18 * * *'  # 4 times a day
     workflow_dispatch:

   jobs:
     sync:
       runs-on: ubuntu-latest
       steps:
         - name: Sync LeetCode submissions
           uses: Buffden/leetcode-sync@master
           with:
             github-token: ${{ secrets.GITHUB_TOKEN }}
             leetcode-csrf-token: ${{ secrets.LEETCODE_CSRF_TOKEN }}
             leetcode-session: ${{ secrets.LEETCODE_SESSION }}
             destination-folder: ''
             verbose: true
             commit-header: '[LeetCode]'
   ```

6. Run the workflow manually from the Actions tab, or wait for the cron to trigger it.

## Inputs

- `github-token` _(required)_: GitHub access token for pushing solutions to the repository
- `leetcode-csrf-token` _(required)_: LeetCode CSRF token for retrieving submissions
- `leetcode-session` _(required)_: LeetCode session cookie for retrieving submissions
- `filter-duplicate-secs` _(optional)_: Seconds after an accepted solution to ignore duplicate submissions for the same problem, default: `86400` (1 day)
- `destination-folder` _(optional)_: Root folder in your repo to save submissions under, default: _none_
- `verbose` _(optional)_: Fetches submission percentiles and question numbers (requires an extra API call), default: `true`
- `commit-header` _(optional)_: Prefix for automated commit messages, default: `[LeetCode]`

## Testing locally

1. Copy `.env.example` to `.env` and fill in your credentials
2. Build the bundle: `npm run package`
3. Run: `npm test`

The sync will commit directly to the repo specified in `GITHUB_REPO` in your `.env`.

## FAQ

#### Job fails with "HttpError: API rate limit exceeded"

You hit GitHub's rate limit — this can happen with 300+ submissions on the first sync. The syncer writes oldest-first, so just re-run the workflow manually after a few minutes to pick up where it left off.

#### Job fails with "HttpError: Resource not accessible by integration"

The GitHub token doesn't have write permission. Go to your solutions repo → Settings → Actions → Workflow Permissions → set to **Read and Write**.

#### Job fails with "Git Repository is empty"

Your solutions repo has no commits yet. Initialize it with a README first, then re-run.
