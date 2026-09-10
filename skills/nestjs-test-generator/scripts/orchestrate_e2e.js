import { Project, Scope, SyntaxKind, IndentationText, QuoteKind } from "ts-morph";
import { resolve, relative, dirname, basename, sep } from "node:path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cliArgs = process.argv.slice(2);

function getArg(name) {
  const idx = cliArgs.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return cliArgs[idx + 1];
}

function hasFlag(name) {
  return cliArgs.includes(`--${name}`);
}

function toForwardSlashes(p) {
  return p.replace(/\\/g, "/");
}

const phase = getArg("phase");
const projectRoot = getArg("project-root") || ".";

if (!phase || !["pre-scan", "scaffold", "inject"].includes(phase)) {
  console.error("Error: --phase <pre-scan|scaffold|inject> is required");
  process.exit(1);
}

const absRoot = resolve(projectRoot);
const workDir = resolve(absRoot, ".test-gen-e2e");
const resourcesDir = resolve(__dirname, "..", "resources");
const templatePath = resolve(resourcesDir, "e2e_prompt_template.txt");

// ─── PHASE 1: PRE-SCAN ─────────────────────────────────────────────────────────

function runPreScan() {
  const targetFolderStr = getArg("target-folder");
  const targetFileStr = getArg("target-file");
  const targetMethodStr = getArg("target-method");
  const rewrite = hasFlag("rewrite");

  const targetFolders = targetFolderStr ? targetFolderStr.split(",").map((s) => s.trim()) : ["."];
  const targetFiles = targetFileStr ? targetFileStr.split(",").map((s) => s.trim()) : [];
  const targetMethods = targetMethodStr ? targetMethodStr.split(",").map((s) => s.trim()) : [];

  const tsConfigPath = resolve(absRoot, "tsconfig.json");
  const projectOptions = { skipAddingFilesFromTsConfig: true };
  if (existsSync(tsConfigPath)) {
    projectOptions.tsConfigFilePath = tsConfigPath;
  }

  const project = new Project(projectOptions);

  if (targetFiles.length > 0) {
    for (const file of targetFiles) {
      const absTargetFile = resolve(absRoot, file);
      if (!existsSync(absTargetFile)) {
        console.error(`Error: Target file not found at ${absTargetFile}`);
        continue;
      }
      project.addSourceFileAtPath(absTargetFile);
    }
  } else {
    const globs = [];
    for (const folder of targetFolders) {
      const absTarget = resolve(absRoot, folder);
      globs.push(`${toForwardSlashes(absTarget)}/**/*.controller.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/node_modules/**`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/dist/**`);
    }
    project.addSourceFilesAtPaths(globs);
  }

  const controllerFiles = project.getSourceFiles();

  if (existsSync(workDir)) {
    rmSync(workDir, { recursive: true, force: true });
  }
  mkdirSync(workDir, { recursive: true });

  let totalMethods = 0;
  let methodsSkipped = 0;
  const deletedSpecs = new Set();

  for (const sf of controllerFiles) {
    const filePath = sf.getFilePath();

    // Determine e2e spec path based on mapping logic
    const testDirMatch = filePath.match(new RegExp(`(.*[\\\\/]src)[\\\\/](.*)`));
    let specPath;
    if (testDirMatch) {
      // Find the top-level subfolder inside src
      const relPathInsideSrc = testDirMatch[2]; // e.g. vcs-responders/github/github.controller.ts
      const domainFolder = relPathInsideSrc.split(/[\\\\/]/)[0]; // e.g. vcs-responders
      const testDir = testDirMatch[1].replace(/[\\\\/]src$/, `${sep}test`);
      specPath = resolve(testDir, `${domainFolder}.e2e-spec.ts`);
    } else {
      const base = basename(filePath, ".controller.ts");
      specPath = resolve(dirname(filePath), `${base}.e2e-spec.ts`);
    }

    const specExists = existsSync(specPath);

    if (specExists && rewrite && !deletedSpecs.has(specPath)) {
      if (targetMethods.length > 0) {
        // Surgical rewrite: remove only the specific describe blocks
        const specSf = project.addSourceFileAtPath(specPath);
        let changedSpec = false;
        const describeCalls = specSf
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .filter((c) => c.getExpression().getText() === "describe");

        for (const call of describeCalls) {
          const arg0 = call.getArguments()[0];
          if (arg0) {
            const descName = arg0.getText().replace(/['"`]/g, "");
            if (targetMethods.includes(descName)) {
              const stmt = call.getParentIfKind(SyntaxKind.ExpressionStatement);
              if (stmt) {
                stmt.remove();
                changedSpec = true;
              }
            }
          }
        }
        if (changedSpec) {
          specSf.saveSync();
        }
      } else {
        rmSync(specPath, { force: true });
        deletedSpecs.add(specPath);
      }
    }

    const classes = sf.getClasses();
    if (classes.length === 0) continue;

    const cls = classes[0];
    const className = cls.getName() || "Unknown";

    const methods = cls.getMethods();
    const methodsNeedingTests = [];

    // Simple test check
    let specText = "";
    if (existsSync(specPath) && !rewrite) {
      try {
        specText = readFileSync(specPath, "utf-8");
      } catch {}
    }

    for (const method of methods) {
      const scope = method.getScope();
      if (scope === Scope.Private || scope === Scope.Protected) continue;
      const methodName = method.getName();
      if (methodName.startsWith("_")) continue;

      const decorators = method.getDecorators();
      const routeDec = decorators.find((d) =>
        ["Get", "Post", "Put", "Delete", "Patch", "EventPattern", "MessagePattern"].includes(
          d.getName(),
        ),
      );
      if (!routeDec) continue;
      if (targetMethods.length > 0 && !targetMethods.includes(methodName)) continue;

      totalMethods++;

      if (specText) {
        const escaped = methodName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (
          new RegExp(`describe\\s*\\(\\s*['"\`]${escaped}['"\`]`, "i").test(specText) &&
          !rewrite
        ) {
          methodsSkipped++;
          continue;
        }
      }

      let routePath = "";
      if (routeDec.getArguments().length > 0) {
        routePath = routeDec.getArguments()[0].getText().replace(/['"]/g, "");
      }

      methodsNeedingTests.push({
        methodName,
        httpMethod: routeDec.getName().toUpperCase(),
        routePath,
        methodSource: method.getText(),
      });
    }

    if (methodsNeedingTests.length === 0) continue;

    const serviceWorkDir = resolve(workDir, className);
    mkdirSync(serviceWorkDir, { recursive: true });

    const astFindings = {
      className,
      controllerFile: relative(absRoot, filePath),
      specFile: relative(absRoot, specPath),
      methods: methodsNeedingTests,
    };
    writeFileSync(
      resolve(serviceWorkDir, "ast_findings.json"),
      JSON.stringify(astFindings, null, 2),
    );

    const testPlan = {};
    for (const m of methodsNeedingTests) {
      testPlan[m.methodName] = [
        {
          id: `${m.methodName}_200`,
          description: `should return 200 OK on successful ${m.httpMethod}`,
        },
        { id: `${m.methodName}_400`, description: `should return 400 on invalid payload` },
      ];
    }
    writeFileSync(resolve(serviceWorkDir, "test_plan.json"), JSON.stringify(testPlan, null, 2));
  }

  console.log(
    `Pre-scan complete. Total methods: ${totalMethods}, Skipped: ${methodsSkipped}. Check .test-gen-e2e folders.`,
  );
}

// ─── PHASE 2: SCAFFOLD ─────────────────────────────────────────────────────────

function runScaffold() {
  if (!existsSync(workDir)) {
    console.error("No .test-gen-e2e directory found. Run pre-scan first.");
    process.exit(1);
  }

  const promptTemplate = readFileSync(templatePath, "utf-8");
  const serviceDirs = readdirSync(workDir).filter((f) =>
    statSync(resolve(workDir, f)).isDirectory(),
  );

  const project = new Project({
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Single,
    },
  });

  for (const service of serviceDirs) {
    const srvDir = resolve(workDir, service);
    const astPath = resolve(srvDir, "ast_findings.json");
    const planPath = resolve(srvDir, "test_plan.json");

    if (!existsSync(astPath) || !existsSync(planPath)) continue;

    const ast = JSON.parse(readFileSync(astPath, "utf-8"));
    const plan = JSON.parse(readFileSync(planPath, "utf-8"));

    mkdirSync(resolve(srvDir, "prompts"), { recursive: true });
    mkdirSync(resolve(srvDir, "responses"), { recursive: true });

    const specPath = resolve(absRoot, ast.specFile);
    if (!existsSync(specPath)) {
      // Compute correct generic import for AppModule assuming it's usually at src/app.module
      // Actually we just use a placeholder that the user/lint might fix or we use a basic one.
      const stub = `import { Test, TestingModule } from '@nestjs/testing';\nimport { INestApplication } from '@nestjs/common';\nimport * as request from 'supertest';\n// TODO: Ensure AppModule path is correct\nimport { AppModule } from '../src/app.module';\nimport { describe, it, expect, beforeAll, afterAll } from "vite-plus/test";\n\ndescribe('${basename(ast.specFile, ".e2e-spec.ts")} (e2e)', () => {\n  let app: INestApplication;\n\n  beforeAll(async () => {\n    const moduleFixture: TestingModule = await Test.createTestingModule({\n      imports: [AppModule],\n    }).compile();\n\n    app = moduleFixture.createNestApplication();\n    await app.init();\n  });\n\n  afterAll(async () => {\n    await app.close();\n  });\n});\n`;
      mkdirSync(dirname(specPath), { recursive: true });
      writeFileSync(specPath, stub, "utf-8");
    }

    const sf = project.addSourceFileAtPath(specPath);

    // Ensure the controller class is imported
    const hasImport = sf
      .getImportDeclarations()
      .some((i) => i.getNamedImports().some((n) => n.getName() === ast.className));
    if (!hasImport) {
      let relPath = relative(dirname(specPath), resolve(absRoot, ast.controllerFile))
        .replace(/\\/g, "/")
        .replace(/\.ts$/, "");
      if (!relPath.startsWith(".")) relPath = "./" + relPath;
      sf.addImportDeclaration({
        moduleSpecifier: relPath,
        namedImports: [ast.className],
      });
    }

    const mainDescribes = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(
        (c) =>
          c.getExpression().getText() === "describe" &&
          c.getArguments()[0]?.getText().includes("(e2e)"),
      );
    const mainDescribe = mainDescribes[mainDescribes.length - 1];

    if (!mainDescribe) {
      console.warn(`Could not find main describe block in ${specPath}`);
      continue;
    }

    const bodyFunc = mainDescribe.getArguments()[1];
    if (
      !bodyFunc ||
      (bodyFunc.getKind() !== SyntaxKind.ArrowFunction &&
        bodyFunc.getKind() !== SyntaxKind.FunctionExpression)
    )
      continue;
    const block = bodyFunc.getBody();

    let controllerDescribe = block
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find(
        (c) =>
          c.getExpression().getText() === "describe" &&
          c.getArguments()[0]?.getText().includes(ast.className),
      );

    if (!controllerDescribe) {
      let describeText = `\n  describe('${ast.className}', () => {\n`;
      for (const methodName of Object.keys(plan)) {
        const cases = plan[methodName];
        describeText += `    describe('${methodName}', () => {\n${cases.map((c) => `      it('${c.description}', async () => {\n        // TASK_ID: ${ast.className}__${methodName}__${c.id}\n      });`).join("\n")}\n    });\n`;
      }
      describeText += `  });\n`;

      const blockText = block.getText();
      const newBody =
        blockText.slice(0, blockText.lastIndexOf("}")) +
        describeText +
        blockText.slice(blockText.lastIndexOf("}"));
      block.replaceWithText(newBody);
    }

    const manifest = { tasks: [] };

    for (const methodName of Object.keys(plan)) {
      const methodData = ast.methods.find((m) => m.methodName === methodName);
      if (!methodData) continue;

      const cases = plan[methodName];
      const promptCases = cases.map((c) => ({
        id: `${ast.className}__${methodName}__${c.id}`,
        description: c.description,
      }));
      const planStr = JSON.stringify(promptCases, null, 2);
      const resPath = `.test-gen-e2e/${service}/responses/${methodName}.json`;

      let promptText = promptTemplate
        .replace("{{CLASS_NAME}}", ast.className)
        .replace("{{METHOD_NAME}}", methodName)
        .replace("{{HTTP_METHOD}}", methodData.httpMethod)
        .replace("{{ROUTE_PATH}}", methodData.routePath)
        .replace("{{METHOD_SOURCE}}", methodData.methodSource)
        .replace("{{TEST_PLAN_JSON}}", planStr)
        .replace("{{RESPONSE_PATH}}", resPath);

      const promptPath = resolve(srvDir, "prompts", `${methodName}.txt`);
      writeFileSync(promptPath, promptText, "utf-8");

      manifest.tasks.push({
        methodName,
        promptFile: relative(absRoot, promptPath),
        responseFile: resPath,
      });
    }

    sf.saveSync();
    writeFileSync(resolve(srvDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  console.log("Scaffold complete. Ready for sub-agents.");
}

// ─── PHASE 3: INJECT ───────────────────────────────────────────────────────────

function runInject() {
  if (!existsSync(workDir)) {
    console.error("No .test-gen-e2e directory found.");
    process.exit(1);
  }

  const serviceDirs = readdirSync(workDir).filter((f) =>
    statSync(resolve(workDir, f)).isDirectory(),
  );
  const project = new Project({
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Single,
    },
  });

  const modifiedSpecs = new Set();

  for (const service of serviceDirs) {
    const srvDir = resolve(workDir, service);
    const astPath = resolve(srvDir, "ast_findings.json");
    if (!existsSync(astPath)) continue;

    const ast = JSON.parse(readFileSync(astPath, "utf-8"));
    const specPath = resolve(absRoot, ast.specFile);
    if (!existsSync(specPath)) continue;

    const sf = project.addSourceFileAtPath(specPath);
    let changed = false;

    const resDir = resolve(srvDir, "responses");
    if (!existsSync(resDir)) continue;

    const resFiles = readdirSync(resDir).filter((f) => f.endsWith(".json"));
    for (const f of resFiles) {
      const payloads = JSON.parse(readFileSync(resolve(resDir, f), "utf-8"));
      if (!Array.isArray(payloads)) continue;

      for (const payload of payloads) {
        const taskId = payload.taskId;
        const code = payload.code.trim();

        // find the comment in AST
        const comments = sf.getDescendantsOfKind(SyntaxKind.SingleLineCommentTrivia);
        for (const comment of comments) {
          if (comment.getText().includes(`TASK_ID: ${taskId}`)) {
            const block = comment.getParentIfKind(SyntaxKind.Block);
            if (block) {
              const indentedCode = code
                .split("\n")
                .map((l) => "        " + l)
                .join("\n");
              block.replaceWithText(`{\n${indentedCode}\n      }`);
              changed = true;
            }
          }
        }
      }
    }
    if (changed) {
      sf.organizeImports();
      sf.saveSync();
      modifiedSpecs.add(specPath);
    }
  }

  for (const spec of modifiedSpecs) {
    try {
      execSync(`vp check --fix "${spec}"`, { cwd: absRoot, stdio: "ignore" });
    } catch {
      console.warn(`vp check --fix failed for ${spec}.`);
    }
  }

  console.log("Injection complete.");
}

if (phase === "pre-scan") runPreScan();
else if (phase === "scaffold") runScaffold();
else if (phase === "inject") runInject();
