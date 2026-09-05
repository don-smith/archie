import { existsSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import compiler from "typescript";
import { API, type Diagnostic, type Project } from "typescript/unstable/sync";
import * as ast from "typescript/unstable/ast";

import { digestJson } from "./digest.js";
import type { EdgeKind, Gap, GraphEdge, GraphNode, NormalizedGraphV1, SourceScope, Span } from "./graph-types.js";
import { canonicalModule, repositoryPath } from "./repository-paths.js";
import type { TypeScriptProgramInput } from "./program-types.js";

const supportedExtensions = [".ts", ".tsx", ".mts", ".cts"];

function globMatches(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${escaped}$`).test(path);
}
function inScope(path: string, scope: SourceScope): boolean { return scope.include.some((pattern) => globMatches(path, pattern)) && !scope.exclusions.some((exclusion) => globMatches(path, exclusion.path)); }
function span(file: string, source: ast.SourceFile, start: number, end: number): Span {
  const first = source.getLineAndCharacterOfPosition(start); const last = source.getLineAndCharacterOfPosition(end);
  return { file, start: { line: first.line + 1, column: first.character + 1 }, end: { line: last.line + 1, column: last.character + 1 } };
}
function moduleNodeId(module: string): string { return `module:${module}`; }
function scalarOptions(options: Record<string, unknown>, repositoryRoot: string): Record<string, string | boolean | number> {
  const entries: [string, string | boolean | number][] = [];
  for (const [name, value] of Object.entries(options)) {
    if (!["string", "boolean", "number"].includes(typeof value)) continue;
    if (typeof value === "string" && isAbsolute(value)) {
      const path = repositoryPath(repositoryRoot, value);
      if (path) entries.push([name, path]);
      continue;
    }
    entries.push([name, value as string | boolean | number]);
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}
function isTypeOnly(node: ast.ImportDeclaration | ast.ExportDeclaration): boolean {
  if (ast.isExportDeclaration(node)) return node.isTypeOnly;
  if (node.importClause?.phaseModifier === ast.SyntaxKind.TypeKeyword) return true;
  const bindings = node.importClause?.namedBindings;
  return Boolean(bindings && ast.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((item) => item.isTypeOnly));
}
function diagnosticGap(diagnostic: Diagnostic, repositoryRoot: string, files: Map<string, ast.SourceFile>): Gap {
  const file = diagnostic.fileName ? repositoryPath(repositoryRoot, diagnostic.fileName) : undefined; const source = diagnostic.fileName ? files.get(resolve(diagnostic.fileName)) : undefined;
  return { kind: "compiler-diagnostic", message: diagnostic.text, ...(file ? { file } : {}), ...(file && source ? { span: span(file, source, diagnostic.pos, diagnostic.end) } : {}) };
}
function declarationExtension(sourcePath: string): string | undefined {
  const extension = extname(sourcePath);
  if (extension === ".mts") return ".d.mts";
  if (extension === ".cts") return ".d.cts";
  return extension === ".ts" || extension === ".tsx" ? ".d.ts" : undefined;
}
function declarationOutputPath(project: Project, sourcePath: string): string | undefined {
  const options = project.program.getCompilerOptions() as { rootDir?: unknown; outDir?: unknown; declarationDir?: unknown };
  const rootDir = options.rootDir; const outputDir = options.declarationDir ?? options.outDir; const extension = declarationExtension(sourcePath);
  if (typeof rootDir !== "string" || typeof outputDir !== "string" || !extension) return undefined;
  const sourceRelative = relative(rootDir, sourcePath);
  if (sourceRelative.startsWith("..") || isAbsolute(sourceRelative)) return undefined;
  const sourceExtension = extname(sourceRelative);
  return resolve(outputDir, `${sourceRelative.slice(0, -sourceExtension.length)}${extension}`);
}
function repositoryFiles(root: string): string[] {
  const result: string[] = []; const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
      const path = resolve(directory, entry.name); if (entry.isDirectory()) visit(path); else if (supportedExtensions.includes(extname(entry.name))) result.push(path);
    }
  };
  visit(root); return result;
}

/** The only module allowed to call the pinned TypeScript compiler API. */
export function analyzeTypeScriptProgram(input: TypeScriptProgramInput, repositoryRoot = process.cwd()): NormalizedGraphV1 {
  const root = resolve(repositoryRoot); const gaps: Gap[] = []; const api = new API({ cwd: root });
  try {
    const rootConfigs = input.rootConfigs.map((config) => resolve(root, config));
    for (const config of rootConfigs) if (!repositoryPath(root, config)) gaps.push({ kind: "root-config-outside-repository", message: `root config is outside the repository: ${config}` });
    const snapshot = api.updateSnapshot({ openProjects: rootConfigs });
    try {
      const projects = snapshot.getProjects(); const sourceFiles = new Map<string, ast.SourceFile>(); const projectFiles = new Set<string>();
      for (const project of projects) for (const sourcePath of project.program.getSourceFileNames()) {
        const source = project.program.getSourceFile(sourcePath); if (source) { sourceFiles.set(resolve(sourcePath), source); projectFiles.add(resolve(sourcePath)); }
      }
      const nodes: GraphNode[] = []; const nodeByFile = new Map<string, GraphNode>();
      for (const sourcePath of [...projectFiles].sort()) {
        const path = repositoryPath(root, sourcePath); if (!path || !supportedExtensions.includes(extname(path)) || !inScope(path, input.scope)) continue;
        const module = canonicalModule(path); const node = { id: moduleNodeId(module), kind: "source-module" as const, module, file: path }; nodes.push(node); nodeByFile.set(sourcePath, node);
      }
      const exclusions = [...projectFiles].map((file) => repositoryPath(root, file)).filter((path): path is string => Boolean(path)).flatMap((path) => input.scope.exclusions.filter((exclusion) => globMatches(path, exclusion.path)).map((exclusion) => ({ path, reason: exclusion.reason })));
      const declarationOwners = new Map<string, string[]>();
      for (const project of projects) for (const sourcePath of project.program.getSourceFileNames()) {
        const sourceNode = nodeByFile.get(resolve(sourcePath)); const outputPath = sourceNode ? declarationOutputPath(project, sourcePath) : undefined;
        if (sourceNode && outputPath) declarationOwners.set(outputPath, [...(declarationOwners.get(outputPath) ?? []), sourceNode.id]);
      }
      const declarationTarget = (path: string): string | undefined => {
        const owners = declarationOwners.get(resolve(path)); return owners?.length === 1 ? owners[0] : undefined;
      };
      const edges: GraphEdge[] = [];
      const ensureExternal = (specifier: string): string => {
        const id = moduleNodeId(`external:${specifier}`); if (!nodes.some((node) => node.id === id)) nodes.push({ id, kind: "external-module", module: `external:${specifier}` }); return id;
      };
      const internalTarget = (specifier: string, sourcePath: string): string | undefined => {
        if (!specifier.startsWith(".")) return undefined;
        const base = resolve(dirname(sourcePath), specifier); const extension = extname(base); const candidates = extension ? [base, `${base.slice(0, -extension.length)}.ts`, `${base.slice(0, -extension.length)}.tsx`, `${base.slice(0, -extension.length)}.mts`, `${base.slice(0, -extension.length)}.cts`] : supportedExtensions.map((item) => `${base}${item}`);
        const target = candidates.map((candidate) => resolve(candidate)).find((candidate) => nodeByFile.has(candidate)); return target ? nodeByFile.get(target)!.id : undefined;
      };
      const addEdge = (project: Project, sourceFile: ast.SourceFile, sourceNode: GraphNode, moduleSpecifier: ast.StringLiteral, kind: EdgeKind, start: number, end: number): void => {
        const specifier = moduleSpecifier.text; const sourceSpan = span(sourceNode.file!, sourceFile, start, end);
        let target = internalTarget(specifier, sourceFile.fileName); let status: "resolved" | "unresolved" = target ? "resolved" : "unresolved";
        if (!target) {
          // The project checker has already applied the pinned compiler's paths, exports, and project-reference resolution.
          const symbol = project.checker.getSymbolAtLocation(moduleSpecifier);
          const declarations = symbol && !project.checker.isUnknownSymbol(symbol) ? symbol.declarations.map((declaration) => {
            const declared = resolve(declaration.path);
            // TypeScript's project protocol canonicalizes file names; recover the program spelling before repository checks.
            return [...projectFiles].find((file) => file.toLocaleLowerCase() === declared.toLocaleLowerCase()) ?? declared;
          }) : [];
          const resolvedPath = declarations.find((path) => nodeByFile.has(path)); const emittedSourceTarget = declarations.map(declarationTarget).find((candidate): candidate is string => Boolean(candidate));
          const outsideScopePath = declarations.map((path) => repositoryPath(root, path)).find((path) => path && supportedExtensions.includes(extname(path)) && !path.split("/").includes("node_modules"));
          if (resolvedPath) { target = nodeByFile.get(resolvedPath)!.id; status = "resolved"; }
          else if (emittedSourceTarget) { target = emittedSourceTarget; status = "resolved"; }
          else if (outsideScopePath) {
            gaps.push({ kind: "workspace-source-outside-scope", message: `workspace source ${specifier} resolves outside selected scope: ${outsideScopePath}`, file: sourceNode.file!, span: sourceSpan });
            return;
          } else if (symbol && !project.checker.isUnknownSymbol(symbol)) { target = ensureExternal(specifier); status = "resolved"; }
        }
        if (!target && specifier.startsWith("node:")) { target = ensureExternal(specifier); status = "resolved"; }
        if (!target) gaps.push({ kind: "unresolved-static-import", message: `cannot resolve ${specifier}`, file: sourceNode.file!, span: sourceSpan });
        const id = digestJson({ source: sourceNode.id, target: target ?? "", kind, specifier, span: sourceSpan });
        edges.push({ id, source: sourceNode.id, ...(target ? { target } : {}), kind, specifier, status, span: sourceSpan });
      };
      for (const project of projects) for (const sourcePath of project.program.getSourceFileNames()) {
        const sourceFile = sourceFiles.get(resolve(sourcePath)); const sourceNode = nodeByFile.get(resolve(sourcePath)); if (!sourceFile || !sourceNode) continue;
        const visit = (node: ast.Node): void => {
          if (ast.isImportDeclaration(node) || ast.isExportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier;
            if (moduleSpecifier && ast.isStringLiteral(moduleSpecifier)) addEdge(project, sourceFile, sourceNode, moduleSpecifier, isTypeOnly(node) ? "type" : "runtime", node.getStart(sourceFile), node.getEnd());
          }
          if (ast.isCallExpression(node) && node.expression.kind === ast.SyntaxKind.ImportKeyword) {
            const specifier = node.arguments[0];
            if (specifier && ast.isStringLiteral(specifier)) addEdge(project, sourceFile, sourceNode, specifier, "runtime", node.getStart(sourceFile), node.getEnd());
            else gaps.push({ kind: "unsupported-dynamic-import", message: "v1 supports string-literal dynamic imports only", file: sourceNode.file!, span: span(sourceNode.file!, sourceFile, node.getStart(sourceFile), node.getEnd()) });
          }
          if (ast.isCallExpression(node) && ast.isIdentifier(node.expression) && node.expression.text === "require") gaps.push({ kind: "unsupported-commonjs-require", message: "v1 supports static ESM imports only", file: sourceNode.file!, span: span(sourceNode.file!, sourceFile, node.getStart(sourceFile), node.getEnd()) });
          node.forEachChild(visit);
        };
        visit(sourceFile);
        gaps.push(...project.program.getSyntacticDiagnostics(sourcePath).map((diagnostic) => diagnosticGap(diagnostic, root, sourceFiles)));
        gaps.push(...project.program.getConfigFileParsingDiagnostics().map((diagnostic) => diagnosticGap(diagnostic, root, sourceFiles)));
      }
      for (const file of repositoryFiles(root)) { const path = repositoryPath(root, file); if (path && inScope(path, input.scope) && !projectFiles.has(resolve(file))) gaps.push({ kind: "scope-file-not-in-program", message: `scoped source is not in a program: ${path}`, file: path }); }
      const configPaths = projects.map((project) => repositoryPath(root, project.configFileName)).filter((path): path is string => Boolean(path)).sort();
      const provenance = { adapter: "typescript-program-v1" as const, compilerVersion: compiler.version, rootConfigs: configPaths, sourceFiles: [...projectFiles].map((file) => repositoryPath(root, file)).filter((path): path is string => Boolean(path)).sort(), resolutionInputs: ["package-lock.json", "package.json"].filter((file) => existsSync(resolve(root, file))), compilerOptions: scalarOptions((projects[0]?.compilerOptions ?? {}) as Record<string, unknown>, root) };
      return { version: "normalized-graph/v1", scope: input.scope, nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)), edges: edges.sort((a, b) => a.id.localeCompare(b.id)), exclusions: exclusions.sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason)), gaps: gaps.sort((a, b) => `${a.kind}:${a.file ?? ""}:${a.message}`.localeCompare(`${b.kind}:${b.file ?? ""}:${b.message}`)), provenance };
    } finally { snapshot.dispose(); }
  } finally { api.close(); }
}
