const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const PROFILES_FILE = path.join(__dirname, 'fixtures', 'category-profiles.json');
const PARSER_FILE = path.join(ROOT, 'services', 'quickAddParser.ts');
const SUITE_FILES = {
  standard: [path.join(__dirname, 'cases.th.json')],
  adversarial: [path.join(__dirname, 'cases.adversarial.th.json')],
  all: [
    path.join(__dirname, 'cases.th.json'),
    path.join(__dirname, 'cases.adversarial.th.json'),
  ],
};

function parseArgs(argv) {
  const options = {
    profile: null,
    id: null,
    json: false,
    suite: 'standard',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--profile') {
      options.profile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--id') {
      options.id = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--suite') {
      options.suite = argv[index + 1] ?? 'standard';
      index += 1;
    }
  }

  return options;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadCases(selectedSuite) {
  const suiteFiles = SUITE_FILES[selectedSuite];
  if (!suiteFiles) {
    throw new Error(`Unknown suite "${selectedSuite}". Available suites: ${Object.keys(SUITE_FILES).join(', ')}`);
  }

  const payloads = suiteFiles.map((filePath) => loadJson(filePath));
  const cases = payloads.flatMap((payload) => (Array.isArray(payload.cases) ? payload.cases : []));
  const metadata = payloads.map((payload, index) => ({
    version: payload.version ?? 1,
    language: payload.language ?? 'th',
    description: payload.description ?? path.basename(suiteFiles[index]),
    source: path.basename(suiteFiles[index]),
  }));

  return { cases, metadata };
}

function loadQuickAddParser() {
  const source = fs.readFileSync(PARSER_FILE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: PARSER_FILE,
  });

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(transpiled.outputText, sandbox, { filename: PARSER_FILE });
  return sandbox.module.exports.quickAddParser || sandbox.exports.quickAddParser;
}

function formatPercent(value, total) {
  if (total === 0) return '0.00%';
  return `${((value / total) * 100).toFixed(2)}%`;
}

function createProfileSummary(name) {
  return {
    profile: name,
    total: 0,
    typePassed: 0,
    categoryPassed: 0,
    amountCases: 0,
    amountPassed: 0,
    overallPassed: 0,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const parser = loadQuickAddParser();
  const profileMap = loadJson(PROFILES_FILE);
  const loadedCases = loadCases(options.suite);
  const cases = loadedCases.cases;

  const seenIds = new Set();
  const filteredCases = cases.filter((testCase) => {
    if (!testCase.id || seenIds.has(testCase.id)) {
      throw new Error(`Duplicate or missing case id: ${testCase.id ?? '<missing>'}`);
    }
    seenIds.add(testCase.id);

    if (!profileMap[testCase.profile]) {
      throw new Error(`Unknown profile "${testCase.profile}" in case ${testCase.id}`);
    }

    if (options.profile && testCase.profile !== options.profile) return false;
    if (options.id && !testCase.id.includes(options.id)) return false;
    return true;
  });

  const profileSummaries = {};
  const failures = [];

  let typePassed = 0;
  let categoryPassed = 0;
  let amountCases = 0;
  let amountPassed = 0;
  let overallPassed = 0;

  const results = filteredCases.map((testCase) => {
    const categories = profileMap[testCase.profile];
    const parsed = parser.parse(testCase.text, categories, {
      preferredType: testCase.preferredType ?? 'expense',
      learningRules: [],
    });

    const actualType = parsed?.type ?? null;
    const actualCategory = parsed?.category?.name ?? null;
    const actualAmount = parsed?.amount ?? null;
    const typeMatch = actualType === testCase.expectedType;
    const categoryMatch = testCase.expectedCategory
      ? actualCategory === testCase.expectedCategory
      : true;
    const hasExpectedAmount = typeof testCase.expectedAmount === 'number';
    const amountMatch = hasExpectedAmount
      ? actualAmount === testCase.expectedAmount
      : true;
    const overallMatch = typeMatch && categoryMatch && amountMatch;

    if (!profileSummaries[testCase.profile]) {
      profileSummaries[testCase.profile] = createProfileSummary(testCase.profile);
    }

    const summary = profileSummaries[testCase.profile];
    summary.total += 1;
    if (typeMatch) summary.typePassed += 1;
    if (categoryMatch) summary.categoryPassed += 1;
    if (hasExpectedAmount) {
      summary.amountCases += 1;
      if (amountMatch) summary.amountPassed += 1;
    }
    if (overallMatch) summary.overallPassed += 1;

    if (typeMatch) typePassed += 1;
    if (categoryMatch) categoryPassed += 1;
    if (hasExpectedAmount) {
      amountCases += 1;
      if (amountMatch) amountPassed += 1;
    }
    if (overallMatch) overallPassed += 1;

    const result = {
      id: testCase.id,
      profile: testCase.profile,
      text: testCase.text,
      expectedType: testCase.expectedType,
      actualType,
      expectedCategory: testCase.expectedCategory ?? null,
      actualCategory,
      expectedAmount: hasExpectedAmount ? testCase.expectedAmount : null,
      actualAmount,
      confidence: parsed?.confidence ?? null,
      typeMatch,
      categoryMatch,
      amountMatch,
      overallMatch,
    };

    if (!overallMatch) {
      failures.push(result);
    }

    return result;
  });

  const report = {
    metadata: {
      suites: loadedCases.metadata,
      totalCases: filteredCases.length,
      selectedSuite: options.suite,
      selectedProfile: options.profile,
      selectedId: options.id,
    },
    summary: {
      typePassed,
      categoryPassed,
      amountCases,
      amountPassed,
      overallPassed,
      typeAccuracy: formatPercent(typePassed, filteredCases.length),
      categoryAccuracy: formatPercent(categoryPassed, filteredCases.length),
      amountAccuracy: amountCases > 0 ? formatPercent(amountPassed, amountCases) : null,
      overallAccuracy: formatPercent(overallPassed, filteredCases.length),
    },
    byProfile: Object.values(profileSummaries).map((summary) => ({
      ...summary,
      typeAccuracy: formatPercent(summary.typePassed, summary.total),
      categoryAccuracy: formatPercent(summary.categoryPassed, summary.total),
      amountAccuracy: summary.amountCases > 0 ? formatPercent(summary.amountPassed, summary.amountCases) : null,
      overallAccuracy: formatPercent(summary.overallPassed, summary.total),
    })),
    failures,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Quick Add Thai Regression');
    console.log(`Suite: ${options.suite}`);
    console.log(`Cases: ${filteredCases.length}`);
    console.log(
      `Type accuracy: ${report.summary.typePassed}/${filteredCases.length} (${report.summary.typeAccuracy})`
    );
    console.log(
      `Category accuracy: ${report.summary.categoryPassed}/${filteredCases.length} (${report.summary.categoryAccuracy})`
    );
    if (report.summary.amountAccuracy !== null) {
      console.log(
        `Amount accuracy: ${report.summary.amountPassed}/${report.summary.amountCases} (${report.summary.amountAccuracy})`
      );
    }
    console.log(
      `Overall accuracy: ${report.summary.overallPassed}/${filteredCases.length} (${report.summary.overallAccuracy})`
    );
    console.log('');

    for (const summary of report.byProfile) {
      console.log(
        `- ${summary.profile}: overall ${summary.overallPassed}/${summary.total} (${summary.overallAccuracy}), type ${summary.typeAccuracy}, category ${summary.categoryAccuracy}${summary.amountAccuracy ? `, amount ${summary.amountAccuracy}` : ''}`
      );
    }

    if (report.failures.length > 0) {
      console.log('');
      console.log('Failures:');
      for (const failure of report.failures) {
        console.log(
          `- ${failure.id} | ${failure.text} | expected ${failure.expectedType}/${failure.expectedCategory}${failure.expectedAmount !== null ? `/${failure.expectedAmount}` : ''} | got ${failure.actualType}/${failure.actualCategory}${failure.actualAmount !== null ? `/${failure.actualAmount}` : ''}`
        );
      }
    }
  }

  if (report.failures.length > 0) {
    process.exitCode = 1;
  }

  return results;
}

main();
