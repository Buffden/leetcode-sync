const axios = require("axios");
const { Octokit } = require("@octokit/rest");
const path = require("path");

const COMMIT_MESSAGE = "[LeetCode]";
const BASE_URL = "https://leetcode.com";

const LANG_TO_EXTENSION = {
  bash: "sh",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  dart: "dart",
  elixir: "ex",
  erlang: "erl",
  golang: "go",
  java: "java",
  javascript: "js",
  kotlin: "kt",
  mssql: "sql",
  mysql: "sql",
  oraclesql: "sql",
  php: "php",
  python: "py",
  python3: "py",
  pythondata: "py",
  postgresql: "sql",
  racket: "rkt",
  ruby: "rb",
  rust: "rs",
  scala: "scala",
  swift: "swift",
  typescript: "ts",
};

// Ordered highest-priority first. When a problem has multiple tags, the first
// match in this list determines the destination folder.
const TAG_PRIORITY = [
  // Tier 1 — specific algorithm patterns
  "sliding-window",
  "two-pointers",
  "divide-and-conquer",
  "topological-sort",
  "union-find",
  "monotonic-stack",
  "monotonic-queue",
  "prefix-sum",
  "backtracking",
  "shortest-path",
  "minimum-spanning-tree",
  // Tier 2 — core algorithms
  "dynamic-programming",
  "greedy",
  "binary-search",
  "breadth-first-search",
  "depth-first-search",
  "bit-manipulation",
  "recursion",
  "memoization",
  // Tier 3 — specific data structures
  "heap-priority-queue",
  "trie",
  "stack",
  "queue",
  "linked-list",
  "binary-search-tree",
  "segment-tree",
  "binary-indexed-tree",
  // Tier 4 — general (fallback)
  "hash-table",
  "string",
  "matrix",
  "tree",
  "graph",
  "math",
  "sorting",
  "array",
];

function getPrimaryTag(topicTags) {
  if (!topicTags || topicTags.length === 0) return "uncategorized";
  const slugs = topicTags.map((t) => t.slug);
  for (const tag of TAG_PRIORITY) {
    if (slugs.includes(tag)) return tag;
  }
  // No match in priority list — fall back to the first tag the API returned
  return slugs[0];
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function log(message) {
  console.log(`[${new Date().toUTCString()}] ${message}`);
}

function pad(n) {
  if (n.length > 4) {
    return n;
  }
  var s = "000" + n;
  return s.substring(s.length - 4);
}

function normalizeName(problemName) {
  return problemName
    .toLowerCase()
    .replace(/\s/g, "-")
    .replace(/[^a-zA-Z0-9_-]/gi, "");
}

function graphqlHeaders(session, csrfToken) {
  return {
    "content-type": "application/json",
    origin: BASE_URL,
    referer: BASE_URL,
    cookie: `csrftoken=${csrfToken}; LEETCODE_SESSION=${session};`,
    "x-csrftoken": csrfToken,
  };
}

async function getInfo(submission, session, csrfToken) {
  let data = JSON.stringify({
    query: `query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtimePercentile
        memoryPercentile
        code
        question {
          questionId
        }
      }
    }`,
    variables: { submissionId: submission.id },
  });

  const headers = graphqlHeaders(session, csrfToken);

  // No need to break on first request error since that would be done when getting submissions
  const getInfo = async (maxRetries = 5, retryCount = 0) => {
    try {
      const response = await axios.post("https://leetcode.com/graphql/", data, {
        headers,
      });
      const submissionDetails = response.data?.data?.submissionDetails;

      const runtimePercentile =
        submissionDetails.runtimePercentile !== null &&
        submissionDetails.runtimePercentile !== undefined
          ? `${submissionDetails.runtimePercentile.toFixed(2)}%`
          : "N/A";

      const memoryPercentile =
        submissionDetails.memoryPercentile !== null &&
        submissionDetails.memoryPercentile !== undefined
          ? `${submissionDetails.memoryPercentile.toFixed(2)}%`
          : "N/A";

      const rawQid = submissionDetails?.question?.questionId?.toString() ?? "0";
      const questionId = pad(rawQid);

      log(`Got info for submission #${submission.id}`);
      return {
        runtimePerc: runtimePercentile,
        memoryPerc: memoryPercentile,
        qid: questionId,
        questionNum: rawQid,
        code: response.data.data.submissionDetails.code,
      };
    } catch (exception) {
      if (retryCount >= maxRetries) {
        // If problem is locked due to user not having LeetCode Premium
        if (exception.response && exception.response.status === 403) {
          log(`Skipping locked problem: ${submission.title}`);
          return null;
        }
        throw exception;
      }
      log(
        "Error fetching submission info, retrying in " +
          3 ** retryCount +
          " seconds..."
      );
      await delay(3 ** retryCount * 1000);
      return getInfo(maxRetries, retryCount + 1);
    }
  };

  info = await getInfo();
  return { ...submission, ...info };
}

function htmlToMarkdown(html) {
  if (!html) return "";
  return html
    .replace(/<pre>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, c) => `\`\`\`\n${c}\n\`\`\``)
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<li>([\s\S]*?)<\/li>/gi, "- $1")
    .replace(/<\/?(ul|ol)>/gi, "")
    .replace(/<p>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1^")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function generateReadme(submission, questionData) {
  const { title, titleSlug, runtime, memory, runtimePerc, memoryPerc, questionNum } =
    submission;
  const difficulty = questionData?.difficulty ?? "N/A";
  const topicTags = questionData?.topicTags ?? [];
  const content = questionData?.content ?? "";
  const hints = questionData?.hints ?? [];
  const similarQuestionsRaw = questionData?.similarQuestions ?? "[]";

  const topicsStr =
    topicTags.length > 0 ? topicTags.map((t) => t.name).join(", ") : "N/A";
  const link = `${BASE_URL}/problems/${titleSlug}/`;

  const runtimeStr =
    runtimePerc && runtimePerc !== "N/A"
      ? `${runtime} (beats ${runtimePerc})`
      : runtime;
  const memoryStr =
    memoryPerc && memoryPerc !== "N/A"
      ? `${memory} (beats ${memoryPerc})`
      : memory;

  const descriptionMd = htmlToMarkdown(content);

  let hintsSection = "";
  if (hints.length > 0) {
    const hintItems = hints
      .map((h, i) => `<details>\n<summary>Hint ${i + 1}</summary>\n\n${htmlToMarkdown(h)}\n\n</details>`)
      .join("\n\n");
    hintsSection = `\n## Hints\n\n${hintItems}\n`;
  }

  let similarSection = "";
  try {
    const similar = JSON.parse(similarQuestionsRaw);
    if (similar.length > 0) {
      const items = similar
        .map((q) => `- [${q.title}](${BASE_URL}/problems/${q.titleSlug}/) (${q.difficulty})`)
        .join("\n");
      similarSection = `\n## Similar Questions\n\n${items}\n`;
    }
  } catch (_) {}

  return `# ${questionNum}. ${title}

**Difficulty:** ${difficulty}
**Link:** ${link}
**Topics:** ${topicsStr}

## Problem

${descriptionMd}
${hintsSection}${similarSection}
## Stats
- Runtime: ${runtimeStr}
- Memory: ${memoryStr}

## Approach

## Complexity
`;
}

async function commit(params) {
  const {
    octokit,
    owner,
    repo,
    defaultBranch,
    commitInfo,
    treeSHA,
    latestCommitSHA,
    submission,
    destinationFolder,
    commitHeader,
    questionData,
  } = params;

  log(`Committing solution for ${submission.titleSlug}...`);

  const prefix = !!destinationFolder ? destinationFolder : "";
  const commitPrefix = !!commitHeader ? commitHeader : COMMIT_MESSAGE;
  const message = `${commitPrefix} ${submission.questionNum}. ${submission.title}`;

  const topicTags = questionData?.topicTags ?? [];
  const primaryTag = getPrimaryTag(topicTags);

  const ext = LANG_TO_EXTENSION[submission.lang] ?? submission.lang;
  const questionFolder = `${submission.qid}-${submission.titleSlug}`;
  const solutionFileName = `${submission.titleSlug}-solution.${ext}`;
  const readmeContent = generateReadme(submission, questionData);

  const dir = path.join(prefix, primaryTag, questionFolder);
  const treeData = [
    {
      path: path.normalize(path.join(dir, "README.md")),
      mode: "100644",
      content: readmeContent,
    },
    {
      path: path.normalize(path.join(dir, solutionFileName)),
      mode: "100644",
      content: `${submission.code}\n`, // Adds newline at EOF to conform to git recommendations
    },
  ];

  const treeResponse = await octokit.git.createTree({
    owner: owner,
    repo: repo,
    base_tree: treeSHA,
    tree: treeData,
  });

  const date = new Date(Number(submission.timestamp) * 1000).toISOString();
  const commitResponse = await octokit.git.createCommit({
    owner: owner,
    repo: repo,
    message: message,
    tree: treeResponse.data.sha,
    parents: [latestCommitSHA],
    author: {
      email: commitInfo.email,
      name: commitInfo.name,
      date: date,
    },
    committer: {
      email: commitInfo.email,
      name: commitInfo.name,
      date: date,
    },
  });

  await octokit.git.updateRef({
    owner: owner,
    repo: repo,
    sha: commitResponse.data.sha,
    ref: "heads/" + defaultBranch,
    force: true,
  });

  log(`Committed solution for ${submission.titleSlug}`);

  return [treeResponse.data.sha, commitResponse.data.sha];
}

async function getQuestionData(titleSlug, leetcodeSession, csrfToken) {
  log(`Getting question data for ${titleSlug}...`);

  const headers = graphqlHeaders(leetcodeSession, csrfToken);
  const graphql = JSON.stringify({
    query: `query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        difficulty
        content
        hints
        similarQuestions
        topicTags {
          name
          slug
        }
      }
    }`,
    variables: { titleSlug: titleSlug },
  });

  try {
    const response = await axios.post(
      "https://leetcode.com/graphql/",
      graphql,
      { headers }
    );
    const result = await response.data;
    return result.data.question;
  } catch (error) {
    // If problem is locked due to user not having LeetCode Premium
    if (error.response && error.response.status === 403) {
      log(`Skipping locked problem: ${titleSlug}`);
      return null;
    }
    console.log("error", error);
  }
}

// Returns false if no more submissions should be added.
function addToSubmissions(params) {
  const {
    response,
    lastTimestamp,
    filterDuplicateSecs,
    submissions_dict,
    submissions,
  } = params;

  for (const submission of response.data.data.submissionList.submissions) {
    submissionTimestamp = Number(submission.timestamp);
    if (submissionTimestamp <= lastTimestamp) {
      return false;
    }
    if (submission.statusDisplay !== "Accepted") {
      continue;
    }
    const name = normalizeName(submission.title);
    const lang = submission.lang;
    if (!submissions_dict[name]) {
      submissions_dict[name] = {};
    }
    // Filter out other accepted solutions less than one day from the most recent one.
    if (
      submissions_dict[name][lang] &&
      submissions_dict[name][lang] - submissionTimestamp < filterDuplicateSecs
    ) {
      continue;
    }
    submissions_dict[name][lang] = submissionTimestamp;
    submissions.push(submission);
  }
  return true;
}

async function sync(inputs) {
  const {
    githubToken,
    owner,
    repo,
    leetcodeCSRFToken,
    leetcodeSession,
    filterDuplicateSecs,
    destinationFolder,
    verbose,
    commitHeader,
  } = inputs;

  const octokit = new Octokit({
    auth: githubToken,
    userAgent: "LeetCode sync to GitHub - GitHub Action",
  });
  // First, get the time the timestamp for when the syncer last ran.
  const commits = await octokit.repos.listCommits({
    owner: owner,
    repo: repo,
    per_page: 100,
  });

  let lastTimestamp = 0;
  // commitInfo is used to get the original name / email to use for the author / committer.
  // Since we need to modify the commit time, we can't use the default settings for the
  // authenticated user.
  let commitInfo = commits.data[commits.data.length - 1].commit.author;
  const expectedPrefix = !!commitHeader ? commitHeader : COMMIT_MESSAGE;
  for (const commit of commits.data) {
    if (!commit.commit.message.startsWith(expectedPrefix)) {
      continue;
    }
    commitInfo = commit.commit.author;
    lastTimestamp = Date.parse(commit.commit.committer.date) / 1000;
    break;
  }

  // Get all Accepted submissions from LeetCode greater than the timestamp.
  let response = null;
  let offset = 0;
  const submissions = [];
  const submissions_dict = {};
  do {
    log(`Getting submission from LeetCode, offset ${offset}`);

    const getSubmissions = async (maxRetries, retryCount = 0) => {
      try {
        const slug = undefined;
        const graphql = JSON.stringify({
          query: `query ($offset: Int!, $limit: Int!, $slug: String) {
              submissionList(offset: $offset, limit: $limit, questionSlug: $slug) {
                  hasNext
                  submissions {
                      id
                      lang
                      timestamp
                      statusDisplay
                      runtime
                      title
                      memory
                      titleSlug
                  }
              }
          }`,
          variables: {
            offset: offset,
            limit: 20,
            slug,
          },
        });

        const headers = graphqlHeaders(leetcodeSession, leetcodeCSRFToken);
        const response = await axios.post(
          "https://leetcode.com/graphql/",
          graphql,
          { headers }
        );
        log(`Successfully fetched submission from LeetCode, offset ${offset}`);
        return response;
      } catch (exception) {
        if (retryCount >= maxRetries) {
          throw exception;
        }
        log(
          "Error fetching submissions, retrying in " +
            3 ** retryCount +
            " seconds..."
        );
        // There's a rate limit on LeetCode API, so wait with backoff before retrying.
        await delay(3 ** retryCount * 1000);
        return getSubmissions(maxRetries, retryCount + 1);
      }
    };
    // On the first attempt, there should be no rate limiting issues, so we fail immediately in case
    // the tokens are configured incorrectly.
    const maxRetries = response === null ? 0 : 5;
    if (response !== null) {
      // Add a 1 second delay before all requests after the initial request.
      await delay(1000);
    }
    response = await getSubmissions(maxRetries);
    if (
      !addToSubmissions({
        response,
        lastTimestamp,
        filterDuplicateSecs,
        submissions_dict,
        submissions,
      })
    ) {
      break;
    }

    offset += 20;
  } while (response.data.data.submissionList.hasNext);

  // We have all submissions we want to write to GitHub now.
  // First, get the default branch to write to.
  const repoInfo = await octokit.repos.get({
    owner: owner,
    repo: repo,
  });
  const defaultBranch = repoInfo.data.default_branch;
  log(`Default branch for ${owner}/${repo}: ${defaultBranch}`);
  // Write in reverse order (oldest first), so that if there's errors, the last sync time
  // is still valid.
  log(`Syncing ${submissions.length} submissions...`);
  let latestCommitSHA = commits.data[0].sha;
  let treeSHA = commits.data[0].commit.tree.sha;
  for (i = submissions.length - 1; i >= 0; i--) {
    submission = await getInfo(
      submissions[i],
      leetcodeSession,
      leetcodeCSRFToken
    );

    if (submission === null) {
      // Skip this submission if it is null (locked problem)
      continue;
    }

    // Get the question data for the submission.
    const questionData = await getQuestionData(
      submission.titleSlug,
      leetcodeSession,
      leetcodeCSRFToken
    );
    if (questionData === null) {
      // Skip this submission if question data is null (locked problem)
      continue;
    }
    [treeSHA, latestCommitSHA] = await commit({
      octokit,
      owner,
      repo,
      defaultBranch,
      commitInfo,
      treeSHA,
      latestCommitSHA,
      submission,
      destinationFolder,
      commitHeader,
      questionData,
    });
  }
  log("Done syncing all submissions.");
}

module.exports = { log, sync };
