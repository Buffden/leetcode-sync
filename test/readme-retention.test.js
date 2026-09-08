const test = require("node:test");
const assert = require("node:assert/strict");

const { _test } = require("../src/action");

const {
  extractUserNotes,
  generateReadme,
} = _test;

test("extractUserNotes returns defaults for a new problem", () => {
  assert.equal(
    extractUserNotes(null),
    "## Approach\n\n## Complexity\n",
  );
});

test("extractUserNotes preserves legacy README content from Approach onward", () => {
  const legacy = [
    "# 3. Longest Substring Without Repeating Characters",
    "",
    "## Stats",
    "- Runtime: 10 ms",
    "",
    "## Approach",
    "",
    "Variable sliding window with a last-seen map.",
    "",
    "## Complexity",
    "",
    "Time O(n), space O(k).",
    "",
    "## Mistakes",
    "",
    "Do not move left backwards.",
    "",
  ].join("\n");

  assert.equal(
    extractUserNotes(legacy),
    [
      "## Approach",
      "",
      "Variable sliding window with a last-seen map.",
      "",
      "## Complexity",
      "",
      "Time O(n), space O(k).",
      "",
      "## Mistakes",
      "",
      "Do not move left backwards.",
    ].join("\n"),
  );
});

test("extractUserNotes preserves marker-owned content", () => {
  const marked = [
    "<!-- LEETCODE_SYNC:START -->",
    "# Auto content",
    "<!-- LEETCODE_SYNC:END -->",
    "",
    "<!-- USER_NOTES:START -->",
    "",
    "## Approach",
    "",
    "My notes.",
    "",
    "## Complexity",
    "",
    "O(n)",
    "",
    "<!-- USER_NOTES:END -->",
    "",
  ].join("\n");

  assert.equal(
    extractUserNotes(marked),
    [
      "## Approach",
      "",
      "My notes.",
      "",
      "## Complexity",
      "",
      "O(n)",
    ].join("\n"),
  );
});

test("generateReadme refreshes sync metadata while retaining user notes", () => {
  const submission = {
    title: "Two Sum",
    titleSlug: "two-sum",
    runtime: "1 ms",
    memory: "44 MB",
    runtimePerc: "99.00%",
    memoryPerc: "80.00%",
    questionNum: "1",
  };

  const questionData = {
    difficulty: "Easy",
    content: "<p>Find the two numbers.</p>",
    hints: [],
    similarQuestions: "[]",
    topicTags: [
      { name: "Array", slug: "array" },
      { name: "Hash Table", slug: "hash-table" },
    ],
  };

  const notes = [
    "## Approach",
    "",
    "Use a complement hash map.",
    "",
    "## Complexity",
    "",
    "Time O(n), space O(n).",
  ].join("\n");

  const readme = generateReadme(submission, questionData, notes);

  assert.match(readme, /<!-- LEETCODE_SYNC:START -->/);
  assert.match(readme, /Runtime: 1 ms \(beats 99\.00%\)/);
  assert.match(readme, /<!-- USER_NOTES:START -->/);
  assert.match(readme, /Use a complement hash map\./);
  assert.match(readme, /Time O\(n\), space O\(n\)\./);
  assert.match(readme, /<!-- USER_NOTES:END -->/);
});
