import { Project, Scope, SyntaxKind, IndentationText, QuoteKind } from "ts-morph";
import { resolve, relative, dirname, basename } from "node:path";
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
const workDir = resolve(absRoot, ".test-gen");
const resourcesDir = resolve(__dirname, "..", "resources");
const templatePath = resolve(resourcesDir, "prompt_template.txt");

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
      globs.push(`${toForwardSlashes(absTarget)}/**/*.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/node_modules/**`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/dist/**`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.spec.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.e2e-spec.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.controller.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.module.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.guard.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.interceptor.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.pipe.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.filter.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.resolver.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.gateway.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.strategy.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.dto.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.entity.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.schema.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.enum.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.type.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.interface.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.abstract.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.constant.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.constants.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.exception.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.error.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.decorator.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.mock.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.stub.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/*.fixture.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/main.ts`);
      globs.push(`!${toForwardSlashes(absTarget)}/**/index.ts`);
    }
    project.addSourceFilesAtPaths(globs);
  }

  const serviceFiles = project.getSourceFiles();

  if (existsSync(workDir)) {
    rmSync(workDir, { recursive: true, force: true });
  }
  mkdirSync(workDir, { recursive: true });

  let totalMethods = 0;
  let methodsSkipped = 0;

  for (const sf of serviceFiles) {
    const filePath = sf.getFilePath();
    const dir = dirname(filePath);
    const base = basename(filePath, ".ts");
    const specPath = resolve(dir, `${base}.spec.ts`);
    const specExists = existsSync(specPath);

    if (specExists && rewrite) {
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
      }
    }

    const classes = sf.getClasses();
    if (classes.length === 0) continue;

    const cls = classes[0];
    const className = cls.getName() || "Unknown";

    const deps = [];
    const ctor = cls.getConstructors()[0];
    if (ctor) {
      for (const param of ctor.getParameters()) {
        const decorators = param.getDecorators().map((d) => d.getName());
        deps.push({
          name: param.getName(),
          type: param.getType().getText(param),
          decorators,
          hasInjectToken: decorators.includes("Inject") || decorators.includes("InjectRepository"),
        });
      }
    }

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

      methodsNeedingTests.push({
        methodName,
        methodSource: method.getText(),
        returnType: method.getReturnType().getText(method),
        parameters: method.getParameters().map((p) => ({
          name: p.getName(),
          type: p.getType().getText(p),
        })),
      });
    }

    if (methodsNeedingTests.length === 0) continue;

    const serviceWorkDir = resolve(workDir, className);
    mkdirSync(serviceWorkDir, { recursive: true });

    const imports = sf.getImportDeclarations().map((imp) => imp.getText());

    const astFindings = {
      className,
      serviceFile: relative(absRoot, filePath),
      specFile: relative(absRoot, specPath),
      dependencies: deps,
      imports,
      methods: methodsNeedingTests,
    };
    writeFileSync(
      resolve(serviceWorkDir, "ast_findings.json"),
      JSON.stringify(astFindings, null, 2),
    );

    const testPlan = {};
    for (const m of methodsNeedingTests) {
      testPlan[m.methodName] = [
        { id: `${m.methodName}_happy`, description: "should return expected result on success" },
        { id: `${m.methodName}_error`, description: "should handle errors appropriately" },
      ];
    }
    writeFileSync(resolve(serviceWorkDir, "test_plan.json"), JSON.stringify(testPlan, null, 2));
  }

  console.log(
    `Pre-scan complete. Total methods: ${totalMethods}, Skipped: ${methodsSkipped}. Check .test-gen folders.`,
  );
}

// ─── PHASE 2: SCAFFOLD ─────────────────────────────────────────────────────────

function runScaffold() {
  if (!existsSync(workDir)) {
    console.error("No .test-gen directory found. Run pre-scan first.");
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
      const mockProviders = ast.dependencies
        .map((dep) => {
          const baseType = dep.type.split("<")[0]; // Strip generics
          if (baseType === "PinoLogger") {
            return `createMockPinoLogger('${ast.className}')`;
          }
          return `{ provide: ${dep.hasInjectToken ? `'${baseType}'` : baseType}, useValue: {} }`;
        })
        .join(",\n        ");

      const allImports = (ast.imports || []).join("\n");
      const needsLoggerImport = ast.dependencies.some(
        (dep) => dep.type.split("<")[0] === "PinoLogger",
      );
      const loggerImport = needsLoggerImport
        ? `\nimport { createMockPinoLogger } from "@pr-review/utils";`
        : "";

      const stub = `${allImports}${loggerImport}\nimport { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";\nimport { Test, TestingModule } from '@nestjs/testing';\nimport { ${ast.className} } from './${basename(ast.serviceFile, ".ts")}';\n\ndescribe('${ast.className}', () => {\n  let service: ${ast.className};\n\n  beforeEach(async () => {\n    const module: TestingModule = await Test.createTestingModule({\n      providers: [\n        ${ast.className},\n        ${mockProviders}\n      ],\n    }).compile();\n\n    service = module.get<${ast.className}>(${ast.className});\n  });\n\n  it('should be defined', () => {\n    expect(service).toBeDefined();\n  });\n});\n`;
      mkdirSync(dirname(specPath), { recursive: true });
      writeFileSync(specPath, stub, "utf-8");
    }

    const sf = project.addSourceFileAtPath(specPath);
    const mainDescribes = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(
        (c) =>
          c.getExpression().getText() === "describe" &&
          c.getArguments()[0]?.getText().includes(ast.className),
      );
    const mainDescribe = mainDescribes[mainDescribes.length - 1];

    if (!mainDescribe) {
      console.warn(`Could not find describe block for ${ast.className} in ${specPath}`);
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

    const manifest = { tasks: [] };

    for (const methodName of Object.keys(plan)) {
      const methodData = ast.methods.find((m) => m.methodName === methodName);
      if (!methodData) continue;

      const cases = plan[methodName];
      const describeText = `\n  describe('${methodName}', () => {\n${cases.map((c) => `    it('${c.description}', async () => {\n      // TASK_ID: ${ast.className}__${methodName}__${c.id}\n    });`).join("\n")}\n  });\n`;

      const blockText = block.getText();
      const newBody =
        blockText.slice(0, blockText.lastIndexOf("}")) +
        describeText +
        blockText.slice(blockText.lastIndexOf("}"));
      block.replaceWithText(newBody);

      const depsStr = ast.dependencies.map((d) => `- ${d.name}: ${d.type}`).join("\n") || "none";
      const promptCases = cases.map((c) => ({
        id: `${ast.className}__${methodName}__${c.id}`,
        description: c.description,
      }));
      const planStr = JSON.stringify(promptCases, null, 2);
      const resPath = `.test-gen/${service}/responses/${methodName}.json`;

      let promptText = promptTemplate
        .replace("{{CLASS_NAME}}", ast.className)
        .replace("{{METHOD_NAME}}", methodName)
        .replace("{{METHOD_SOURCE}}", methodData.methodSource)
        .replace("{{DEPENDENCIES}}", depsStr)
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
    console.error("No .test-gen directory found.");
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
                .map((l) => "      " + l)
                .join("\n");
              block.replaceWithText(`{\n${indentedCode}\n    }`);
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
