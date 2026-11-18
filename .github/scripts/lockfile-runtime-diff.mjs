#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const args = { after: "pnpm-lock.yaml" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--before") args.before = argv[++i];
    else if (argv[i] === "--after") args.after = argv[++i];
  }
  if (!args.before) throw new Error("--before <path> is required");
  return args;
}

function mainDocumentLines(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return lines;
  const second = lines.indexOf("---", 1);
  return second === -1 ? lines : lines.slice(second + 1);
}

function bareVersion(reference) {
  return reference
    ?.replace(/^npm:/, "")
    .split("(")[0]
    .replace(/^(?:@[^/]+\/)?[^@/]+@(?=\d)/, "");
}

function peerReferences(bindings) {
  return Object.entries(bindings).flatMap(([name, binding]) => {
    const version = typeof binding === "string" ? binding : binding?.version;
    return [...(version ? [`${name}@${version}`] : []), ...peerReferences(binding?.with ?? {})];
  });
}

function normalizeDependencies(
  dependencies,
  catalogs = {},
  includeCatalogSpecifiers = false,
  packages = {},
  providers = {},
) {
  const normalized = {};
  for (const name of Object.keys(dependencies).sort()) {
    const dependency = dependencies[name];
    const specifier = typeof dependency === "string" ? dependency : dependency.specifier;
    const catalog = specifier?.startsWith("catalog:")
      ? catalogs[specifier.slice(8) || "default"]?.[name]
      : undefined;
    const catalogSpecifier = typeof catalog === "string" ? catalog : catalog?.specifier;
    const catalogVersion =
      typeof catalog === "string" ? catalog : (catalog?.version ?? catalog?.specifier);
    const resolved =
      typeof dependency === "string" ? catalogVersion : (dependency.version ?? catalogVersion);
    const version = bareVersion(resolved);
    const reference = (resolved ?? specifier)?.replace(/^npm:/, "").split("(")[0];
    const aliasSpecifier = catalogSpecifier ?? specifier;
    const alias = aliasSpecifier?.startsWith("npm:") ? aliasSpecifier.slice(4) : undefined;
    const separator = alias?.lastIndexOf("@") ?? -1;
    const packageName = alias ? (separator > 0 ? alias.slice(0, separator) : alias) : name;
    const entry = packages[`${packageName}@${reference}`] ?? packages[reference];
    const explicitPeers = typeof dependency === "string" ? {} : (dependency.with ?? {});
    const peers = [
      ...Array.from((resolved ?? "").matchAll(/\(([^()]+)/g), (match) => match[1]),
      ...Object.entries({ ...entry?.peerDependencies, ...explicitPeers }).flatMap(
        ([peerName, peer]) => {
          const provider = providers[peerName];
          let providerVersion = typeof provider === "string" ? provider : provider?.version;
          if (!providerVersion && provider?.specifier?.startsWith("catalog:")) {
            providerVersion = provider.specifier;
          }
          if (providerVersion?.startsWith("catalog:")) {
            const binding = catalogs[providerVersion.slice(8) || "default"]?.[peerName];
            providerVersion = typeof binding === "string" ? binding : binding?.version;
          }
          const explicit = explicitPeers[peerName];
          const explicitVersion = typeof explicit === "string" ? explicit : explicit?.version;
          const peerVersion =
            explicitVersion ??
            (typeof peer === "string"
              ? /^\d/.test(peer) && !entry.snapshots
                ? peer
                : undefined
              : peer?.version) ??
            providerVersion;
          return peerVersion
            ? peerReferences({
                [peerName]: {
                  version: peerVersion,
                  with: explicit?.with ?? peer?.with ?? provider?.with,
                },
              })
            : [];
        },
      ),
    ];
    normalized[name] = {
      specifier: specifier === "catalog:default" ? "catalog:" : specifier,
      ...(includeCatalogSpecifiers && catalogSpecifier ? { catalogSpecifier } : {}),
      ...(peers.length ? { peers: [...new Set(peers)].sort() } : {}),
      ...(version &&
      version !== bareVersion(specifier) &&
      !specifier.startsWith("workspace:") &&
      !catalogSpecifier?.startsWith("workspace:")
        ? { version }
        : {}),
    };
  }
  return Object.keys(normalized).length ? JSON.stringify(normalized) : undefined;
}

function parseYamlCatalogs(lines) {
  const catalogs = {};
  let active = false;
  let catalog;
  let dependency;
  for (const line of lines) {
    if (!active) {
      if (/^catalogs:\s*$/.test(line)) active = true;
      continue;
    }
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\S/.test(line)) break;
    const catalogEntry = line.match(/^ {2}(\S.*):\s*$/);
    const dependencyEntry = line.match(/^ {4}(\S.*):\s*$/);
    const field = line.match(/^ {6}(specifier|version):\s*(.+)$/);
    if (catalogEntry) {
      catalog = catalogEntry[1].replace(/^["']|["']$/g, "");
      catalogs[catalog] = {};
    } else if (dependencyEntry && catalog) {
      dependency = dependencyEntry[1].replace(/^["']|["']$/g, "");
      catalogs[catalog][dependency] = {};
    } else if (field && catalog && dependency) {
      catalogs[catalog][dependency][field[1]] = field[2].replace(/^["']|["']$/g, "");
    }
  }
  return catalogs;
}

function normalizeYamlDependencies(lines, catalogs) {
  const dependencies = {};
  let name;
  for (const line of lines) {
    const entry = line.match(/^ {6}(\S.*):\s*$/);
    if (entry) {
      name = entry[1].replace(/^["']|["']$/g, "");
      dependencies[name] = {};
    } else {
      const field = line.match(/^ {8}(specifier|version):\s*(.+)$/);
      if (name && field) dependencies[name][field[1]] = field[2].replace(/^["']|["']$/g, "");
    }
  }
  return normalizeDependencies(dependencies, catalogs, true);
}

function parseImporters(text, normalize = false) {
  const document = mainDocumentLines(text).join("\n").trimStart();
  if (document.startsWith("{")) {
    const lockfile = JSON.parse(
      document.replace(/("(?:[^"\\]|\\.)*")|,\s*(?=[}\]])/g, (match, string) => string ?? ""),
    );
    return Object.fromEntries(
      Object.entries(lockfile.projects ?? {}).map(([path, project]) => {
        const root = lockfile.projects["."] ?? {};
        const providers = {
          ...root.optionalDependencies,
          ...root.devDependencies,
          ...root.dependencies,
          ...project.optionalDependencies,
          ...project.devDependencies,
          ...project.dependencies,
        };
        const resolvedDependencies = normalizeDependencies(
          project.dependencies ?? {},
          lockfile.settings?.catalogs,
          true,
          lockfile.packages,
          providers,
        );
        return [
          path,
          normalize
            ? resolvedDependencies
            : Object.keys(project.dependencies ?? {}).length
              ? JSON.stringify(
                  { dependencies: project.dependencies, resolvedDependencies },
                  (_key, value) => (value === "catalog:default" ? "catalog:" : value),
                )
              : undefined,
        ];
      }),
    );
  }
  const lines = mainDocumentLines(text);
  const catalogs = parseYamlCatalogs(lines);
  const importersIdx = lines.findIndex((l) => /^importers:\s*$/.test(l));
  if (importersIdx === -1) return {};

  const importers = {};
  let currentImporter = null;
  let currentSection = null;
  let sectionLines = [];

  const flush = () => {
    if (currentImporter && currentSection === "dependencies") {
      importers[currentImporter] = normalize
        ? normalizeYamlDependencies(sectionLines, catalogs)
        : sectionLines.length
          ? JSON.stringify({
              dependencies: sectionLines.join("\n"),
              resolvedDependencies: normalizeYamlDependencies(sectionLines, catalogs),
            })
          : undefined;
    }
    sectionLines = [];
  };

  for (let i = importersIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const indent = line.match(/^ */)[0].length;
    if (indent === 0) break; // back to top-level key, importers block ended

    if (indent === 2) {
      flush();
      currentImporter = line
        .trim()
        .replace(/:$/, "")
        .replace(/^["']|["']$/g, "");
      currentSection = null;
      continue;
    }
    if (indent === 4) {
      flush();
      currentSection = line.trim().replace(/:$/, "");
      continue;
    }
    if (currentSection === "dependencies") sectionLines.push(line);
  }
  flush();

  return importers;
}

function readPackageMeta(importerPath) {
  const pkgPath = importerPath === "." ? "package.json" : join(importerPath, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return { name: pkg.name, private: pkg.private === true };
  } catch {
    return null;
  }
}

function loadFixedGroupNormalizer() {
  const map = new Map();
  try {
    const config = JSON.parse(readFileSync(".changeset/config.json", "utf8"));
    for (const group of config.fixed ?? []) {
      for (const name of group) map.set(name, group[0]);
    }
  } catch {
    // no config.json or no "fixed" groups — normalization is a no-op
  }
  return (name) => map.get(name) ?? name;
}

function main() {
  const { before, after } = parseArgs(process.argv.slice(2));

  const beforeText = readFileSync(before, "utf8");
  const afterText = readFileSync(after, "utf8");
  const isJson = (text) => mainDocumentLines(text).join("\n").trimStart().startsWith("{");
  const mixedFormat = isJson(beforeText) !== isJson(afterText);
  const beforeImporters = parseImporters(beforeText, mixedFormat);
  const afterImporters = parseImporters(afterText, mixedFormat);

  const paths = new Set([...Object.keys(beforeImporters), ...Object.keys(afterImporters)]);
  const normalize = loadFixedGroupNormalizer();
  const changedNames = new Set();

  for (const importerPath of paths) {
    const beforeDeps = beforeImporters[importerPath] ?? "";
    const afterDeps = afterImporters[importerPath] ?? "";
    if (beforeDeps === afterDeps) continue;

    const meta = readPackageMeta(importerPath);
    if (!meta || meta.private || !meta.name) continue;
    changedNames.add(normalize(meta.name));
  }

  const sortedNames = [...changedNames].sort();
  const hasRuntimeChanges = sortedNames.length > 0;
  console.log(
    hasRuntimeChanges
      ? `Runtime dependency changes detected in: ${sortedNames.join(", ")}`
      : "No runtime dependency changes (devDependencies-only and/or policy-list pruning).",
  );

  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const delimiter = `LOCKFILE_DIFF_EOF_${randomUUID()}`;
    appendFileSync(outputFile, `has-runtime-changes=${hasRuntimeChanges}\n`);
    appendFileSync(
      outputFile,
      `changed-names<<${delimiter}\n${sortedNames.join("\n")}\n${delimiter}\n`,
    );
  }
}

main();
