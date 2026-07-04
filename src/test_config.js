require("dotenv").config();
// Modify this file to run index.js locally and not as a GitHub Action.
// Copy .env.example to .env and fill in your real values — never commit .env.

module.exports = {
  // Required: GitHub personal access token with repo scope
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  // Required: target repo where solutions are committed, format: 'owner/repo'
  GITHUB_REPO: process.env.GITHUB_REPO,
  // Required: grab from your browser cookies on leetcode.com (csrftoken)
  LEETCODE_CSRF_TOKEN: process.env.LEETCODE_CSRF_TOKEN,
  // Required: grab from your browser cookies on leetcode.com (LEETCODE_SESSION)
  LEETCODE_SESSION: process.env.LEETCODE_SESSION,

  // Optional — defaults shown below
  FILTER_DUPLICATE_SECS: process.env.FILTER_DUPLICATE_SECS ?? 86400,
  DESTINATION_FOLDER: process.env.DESTINATION_FOLDER ?? "",
  VERBOSE: process.env.VERBOSE ?? true,
  COMMIT_HEADER: process.env.COMMIT_HEADER ?? "[LeetCode]",
};
