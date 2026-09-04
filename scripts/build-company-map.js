// Regenerates data/company-tags.json from Buffden/leetcode-companywise-interview-questions.
// That repo is a dated snapshot, not a live API, so this is a manual/periodic build step —
// run `node scripts/build-company-map.js` whenever you want to refresh company tags.
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const REPO = "Buffden/leetcode-companywise-interview-questions";
const BRANCH = "master";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "company-tags.json");
const CONCURRENCY = 15;

// Folder names are lowercase-hyphenated slugs (e.g. "akuna-capital", "ibm").
// Plain title-casing mangles acronyms and a few branded names, so override those.
const FULL_NAME_OVERRIDES = {
  "de-shaw": "D. E. Shaw",
  "c3-ai": "C3.ai",
};
const WORD_OVERRIDES = {
  amd: "AMD", ibm: "IBM", ey: "EY", kla: "KLA", hcl: "HCL", sap: "SAP",
  ukg: "UKG", vk: "VK", fpt: "FPT", tcs: "TCS", att: "AT&T", pwc: "PwC",
  kpmg: "KPMG", ubs: "UBS", rbc: "RBC", hsbc: "HSBC", dtcc: "DTCC",
  drw: "DRW", hrt: "HRT", ncr: "NCR", msci: "MSCI", gep: "GEP", exl: "EXL",
  jd: "JD.com", adp: "ADP", hp: "HP", hpe: "HPE", hbo: "HBO", dji: "DJI",
  ctc: "CTC", sig: "SIG", ust: "UST", usaa: "USAA", tiaa: "TIAA", htc: "HTC",
  bcg: "BCG", fico: "FICO", imc: "IMC", okx: "OKX", ixl: "IXL", ivp: "IVP",
  jtg: "JTG", lti: "LTI", goto: "GoTo",
};

function toDisplayName(folderName) {
  if (FULL_NAME_OVERRIDES[folderName]) return FULL_NAME_OVERRIDES[folderName];
  return folderName
    .split("-")
    .map((w) => WORD_OVERRIDES[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Minimal CSV line parser — handles quoted fields with embedded commas,
// e.g. `"Pow(x, n)"`, which plain split(",") would break on.
function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function extractSlug(url) {
  const match = url.match(/\/problems\/([^/]+)\/?/);
  return match ? match[1] : null;
}

async function getCompanyFolders() {
  const response = await axios.get(
    `https://api.github.com/repos/${REPO}/contents`,
    {
      params: { ref: BRANCH },
      headers: { "User-Agent": "leetcode-sync-build-company-map" },
    }
  );
  return response.data
    .filter((entry) => entry.type === "dir")
    .map((entry) => entry.name);
}

async function getCompanyCsv(folder) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${folder}/all.csv`;
  const response = await axios.get(url, { responseType: "text" });
  return response.data;
}

async function mapWithConcurrency(items, limit, fn) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function build() {
  console.log("Fetching company folder list...");
  const folders = await getCompanyFolders();
  console.log(`Found ${folders.length} companies. Fetching CSVs...`);

  const slugToCompanies = new Map();
  const skipped = [];
  let done = 0;

  await mapWithConcurrency(folders, CONCURRENCY, async (folder) => {
    const displayName = toDisplayName(folder);
    try {
      const csv = await getCompanyCsv(folder);
      const lines = csv.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines.slice(1)) {
        const fields = parseCsvLine(line);
        const url = fields[1];
        if (!url) continue;
        const slug = extractSlug(url);
        if (!slug) continue;
        if (!slugToCompanies.has(slug)) {
          slugToCompanies.set(slug, new Set());
        }
        slugToCompanies.get(slug).add(displayName);
      }
    } catch (err) {
      skipped.push(folder);
    }
    done++;
    if (done % 100 === 0) {
      console.log(`  ${done}/${folders.length} companies processed`);
    }
  });

  const output = {};
  for (const slug of Array.from(slugToCompanies.keys()).sort()) {
    output[slug] = Array.from(slugToCompanies.get(slug)).sort();
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");

  console.log(
    `Wrote ${Object.keys(output).length} problems to ${path.relative(process.cwd(), OUTPUT_PATH)}`
  );
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} folders with no readable all.csv: ${skipped.join(", ")}`);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
