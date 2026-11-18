import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./lockfile-runtime-diff.mjs", import.meta.url));
const v13 = (dependencies, devDependencies = {}) => `---
lockfileVersion: '9.0'
importers: {}
---
{
  "lockfileVersion": "13.0",
  "projects": {
    "lib": {
      "dependencies": ${JSON.stringify(dependencies)},
      "devDependencies": ${JSON.stringify(devDependencies)},
    },
  },
}
`;

function runDiff(before, after) {
  const dir = mkdtempSync(join(tmpdir(), "lockfile-runtime-diff-"));
  try {
    mkdirSync(join(dir, "lib"));
    writeFileSync(join(dir, "lib/package.json"), JSON.stringify({ name: "example" }));
    writeFileSync(join(dir, "before.yaml"), before);
    writeFileSync(join(dir, "after.yaml"), after);
    const result = spawnSync(
      process.execPath,
      [script, "--before", "before.yaml", "--after", "after.yaml"],
      {
        cwd: dir,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("detects runtime dependency updates in v13 project documents", () => {
  assert.match(
    runDiff(v13({ example: "1.0.0" }), v13({ example: "2.0.0" })),
    /Runtime dependency changes detected in: example/,
  );
  assert.match(
    runDiff(
      v13({ example: "1.0.0" }, { tool: "1.0.0" }),
      v13({ example: "1.0.0" }, { tool: "2.0.0" }),
    ),
    /No runtime dependency changes/,
  );
});

test("does not report unchanged dependencies when migrating from v9 to v13", () => {
  const before = `---
lockfileVersion: '9.0'
importers:
  .:
    packageManagerDependencies: {}
---
lockfileVersion: '9.0'
importers:
  lib:
    dependencies:
      example:
        specifier: ^1.0.0
        version: 1.2.0
`;
  assert.match(
    runDiff(before, v13({ example: { specifier: "^1.0.0", version: "1.2.0" } })),
    /No runtime dependency changes/,
  );
  assert.match(
    runDiff(before, v13({ example: { specifier: "^1.0.0", version: "1.3.0" } })),
    /Runtime dependency changes detected in: example/,
  );
});

test("ignores added projects without runtime dependencies", () => {
  const before = `{"lockfileVersion":"13.0","projects":{}}`;
  assert.match(
    runDiff(before, v13(undefined, { tool: "1.0.0" }).replace('"dependencies": undefined,', "")),
    /No runtime dependency changes/,
  );
});

test("detects runtime updates when lockfiles have CRLF line endings", () => {
  assert.match(
    runDiff(
      v13({ example: "1.0.0" }).replaceAll("\n", "\r\n"),
      v13({ example: "2.0.0" }).replaceAll("\n", "\r\n"),
    ),
    /Runtime dependency changes detected in: example/,
  );
});

test("detects resolved catalog updates across lockfile formats", () => {
  const before = `lockfileVersion: '9.0'
catalogs:
  default:
    example:
      specifier: 1.0.0
      version: 1.0.0
importers:
  lib:
    dependencies:
      example:
        specifier: catalog:
        version: 1.0.0
`;
  const after = v13({ example: "catalog:" }).replace(
    '"projects": {',
    '"settings": { "catalogs": { "default": { "example": "2.0.0" } } }, "projects": {',
  );
  assert.match(
    runDiff(before, after.replace('"example": "2.0.0"', '"example": "1.0.0"')),
    /No runtime dependency changes/,
  );
  assert.match(runDiff(before, after), /Runtime dependency changes detected in: example/);
});

test("detects resolved catalog updates between v13 lockfiles", () => {
  const after = v13({ example: "catalog:" }).replace(
    '"projects": {',
    '"settings": { "catalogs": { "default": { "example": "2.0.0" } } }, "projects": {',
  );
  const before = after.replace('"example": "2.0.0"', '"example": "1.0.0"');
  assert.match(runDiff(before, after), /Runtime dependency changes detected in: example/);
});

test("detects catalog range updates when the resolved version stays unchanged", () => {
  const before = v13({ example: "catalog:" }).replace(
    '"projects": {',
    '"settings": { "catalogs": { "default": { "example": { "specifier": "^1.0.0", "version": "1.2.0" } } } }, "projects": {',
  );
  const after = before.replace('"specifier": "^1.0.0"', '"specifier": "^1.1.0"');
  assert.match(runDiff(before, after), /Runtime dependency changes detected in: example/);
});

test("detects catalog range changes during a v9 to v13 migration", () => {
  const before = `lockfileVersion: '9.0'
catalogs:
  default:
    example:
      specifier: ^1.0.0
      version: 1.2.0
importers:
  lib:
    dependencies:
      example:
        specifier: catalog:
        version: 1.2.0
`;
  const same = v13({ example: "catalog:" }).replace(
    '"projects": {',
    '"settings": { "catalogs": { "default": { "example": { "specifier": "^1.0.0", "version": "1.2.0" } } } }, "projects": {',
  );
  assert.match(runDiff(before, same), /No runtime dependency changes/);
  const changed = same.replace('"specifier": "^1.0.0"', '"specifier": "^1.1.0"');
  assert.match(runDiff(before, changed), /Runtime dependency changes detected in: example/);
});

test("detects catalog range changes between v9 lockfiles", () => {
  const before = `lockfileVersion: '9.0'
catalogs:
  default:
    example:
      specifier: ^1.0.0
      version: 1.2.0
importers:
  lib:
    dependencies:
      example:
        specifier: catalog:
        version: 1.2.0
`;
  const after = before.replace("specifier: ^1.0.0", "specifier: ^1.1.0");
  assert.match(runDiff(before, after), /Runtime dependency changes detected in: example/);
});

test("resolves catalogs for dependency objects without explicit versions", () => {
  const before = v13({ example: { specifier: "catalog:", with: { peer: "3.0.0" } } }).replace(
    '"projects": {',
    '"settings": { "catalogs": { "default": { "example": { "specifier": "^1.0.0", "version": "1.2.0" } } } }, "projects": {',
  );
  const after = before.replace('"version": "1.2.0"', '"version": "1.3.0"');
  assert.match(runDiff(before, after), /Runtime dependency changes detected in: example/);
});

test("keeps named catalog metadata after a YAML comment", () => {
  const before = `lockfileVersion: '9.0'
catalogs:
  default:
    other:
      specifier: ^1.0.0
      version: 1.2.0
# Named catalog
  named:
    example:
      specifier: ^1.0.0
      version: 1.2.0
importers:
  lib:
    dependencies:
      example:
        specifier: catalog:named
        version: 1.2.0
`;
  const after = before.replace(
    "named:\n    example:\n      specifier: ^1.0.0",
    "named:\n    example:\n      specifier: ^1.1.0",
  );
  assert.match(runDiff(before, after), /Runtime dependency changes detected in: example/);
});

for (const [specifier, version] of [
  ["1.2.0", "1.2.0"],
  ["npm:target@1.2.0", "target@1.2.0"],
  ["workspace:*", "link:../other"],
]) {
  test(`preserves unchanged compact catalog entries during migration: ${specifier}`, () => {
    const before = `lockfileVersion: '9.0'
catalogs:
  default:
    other:
      specifier: ${specifier}
      version: ${version}
importers:
  lib:
    dependencies:
      other:
        specifier: catalog:
        version: ${version}
`;
    const after = v13({ other: "catalog:" }).replace(
      '"projects": {',
      `"settings": { "catalogs": { "default": { "other": ${JSON.stringify(specifier)} } } }, "projects": {`,
    );
    assert.match(runDiff(before, after), /No runtime dependency changes/);
  });
}

test("treats default catalog aliases as equivalent during migration", () => {
  const before = `lockfileVersion: '9.0'
catalogs:
  default:
    other:
      specifier: 1.2.0
      version: 1.2.0
importers:
  lib:
    dependencies:
      other:
        specifier: catalog:default
        version: 1.2.0
`;
  const after = v13({ other: "catalog:" }).replace(
    '"projects": {',
    '"settings": { "catalogs": { "default": { "other": "1.2.0" } } }, "projects": {',
  );
  assert.match(runDiff(before, after), /No runtime dependency changes/);
});

const v13Peer = (version) =>
  JSON.stringify({
    lockfileVersion: "13.0",
    projects: {
      lib: { dependencies: { "react-dom": "18.2.0" }, devDependencies: { react: version } },
    },
    packages: {
      "react-dom@18.2.0": {
        peerDependencies: { react: { specifier: "^18.2.0", version } },
      },
    },
  });
const v9Peer = `lockfileVersion: '9.0'
importers:
  lib:
    dependencies:
      react-dom:
        specifier: 18.2.0
        version: 18.2.0(react@18.2.0)
`;

test("preserves equivalent resolved peers when migrating lockfile formats", () => {
  assert.match(runDiff(v9Peer, v13Peer("18.2.0")), /No runtime dependency changes/);
});

test("detects resolved peer updates in v13 package entries", () => {
  const before = JSON.parse(v13Peer("18.2.0"));
  const after = JSON.parse(v13Peer("18.3.1"));
  delete before.projects.lib.devDependencies;
  delete after.projects.lib.devDependencies;
  assert.match(
    runDiff(JSON.stringify(before), JSON.stringify(after)),
    /Runtime dependency changes detected in: example/,
  );
});

test("detects resolved peer updates across lockfile formats", () => {
  assert.match(
    runDiff(v9Peer, v13Peer("18.3.1")),
    /Runtime dependency changes detected in: example/,
  );
  assert.match(
    runDiff(v13Peer("18.3.1"), v9Peer),
    /Runtime dependency changes detected in: example/,
  );
});

test("detects project peer changes when shared package snapshots stay unchanged", () => {
  const lock = (react) =>
    JSON.stringify({
      lockfileVersion: "13.0",
      projects: {
        lib: { dependencies: { "react-dom": "18.2.0" }, devDependencies: { react } },
        alt: {
          dependencies: { "react-dom": "18.2.0" },
          devDependencies: { react: react === "18.2.0" ? "18.3.1" : "18.2.0" },
        },
      },
      packages: {
        "react-dom@18.2.0": {
          peerDependencies: { react: "^18.2.0" },
          snapshots: [
            { peerDependencies: { react: { version: "18.2.0" } } },
            { peerDependencies: { react: { version: "18.3.1" } } },
          ],
        },
      },
    });
  assert.match(runDiff(v9Peer, lock("18.2.0")), /No runtime dependency changes/);
  assert.match(
    runDiff(lock("18.2.0"), lock("18.3.1")),
    /Runtime dependency changes detected in: example/,
  );
});

test("resolves named catalogs used by project peer providers", () => {
  const lock = (version) =>
    JSON.stringify({
      lockfileVersion: "13.0",
      settings: { catalogs: { lib: { react: version } } },
      projects: {
        lib: {
          dependencies: { "react-dom": "18.2.0" },
          devDependencies: { react: "catalog:lib" },
        },
      },
      packages: {
        "react-dom@18.2.0": {
          peerDependencies: { react: "^18.2.0" },
          snapshots: [
            { peerDependencies: { react: { version: "18.2.0" } } },
            { peerDependencies: { react: { version: "18.3.1" } } },
          ],
        },
      },
    });
  assert.match(
    runDiff(lock("18.2.0"), lock("18.3.1")),
    /Runtime dependency changes detected in: example/,
  );
});

test("preserves ranged catalog aliases across lockfile formats", () => {
  for (const target of ["target", "@scope/target"]) {
    const before = `lockfileVersion: '9.0'
catalogs:
  default:
    alias:
      specifier: 'npm:${target}@^1.0.0'
      version: 1.2.0
importers:
  lib:
    dependencies:
      alias:
        specifier: 'catalog:'
        version: '${target}@1.2.0'
`;
    const after = JSON.stringify({
      lockfileVersion: "13.0",
      settings: {
        catalogs: { default: { alias: { specifier: `npm:${target}@^1.0.0`, version: "1.2.0" } } },
      },
      projects: { lib: { dependencies: { alias: "catalog:" } } },
    });
    assert.match(runDiff(before, after), /No runtime dependency changes/);
  }
});

test("treats default catalog spellings as equivalent between v13 lockfiles", () => {
  const lock = (specifier) =>
    JSON.stringify({
      lockfileVersion: "13.0",
      settings: { catalogs: { default: { example: "1.2.0" } } },
      projects: { lib: { dependencies: { example: specifier } } },
    });
  assert.match(runDiff(lock("catalog:"), lock("catalog:default")), /No runtime dependency changes/);
});

test("preserves peers of ranged catalog aliases during format migration", () => {
  for (const target of ["target", "@scope/target"]) {
    const before = `lockfileVersion: '9.0'
catalogs:
  default:
    alias:
      specifier: 'npm:${target}@^1.0.0'
      version: 1.2.0
importers:
  lib:
    dependencies:
      alias:
        specifier: 'catalog:'
        version: '${target}@1.2.0(peer@2.0.0)'
`;
    const after = JSON.stringify({
      lockfileVersion: "13.0",
      settings: {
        catalogs: { default: { alias: { specifier: `npm:${target}@^1.0.0`, version: "1.2.0" } } },
      },
      projects: { lib: { dependencies: { alias: "catalog:" } } },
      packages: {
        [`${target}@1.2.0`]: {
          peerDependencies: { peer: { specifier: "^2.0.0", version: "2.0.0" } },
        },
      },
    });
    assert.match(runDiff(before, after), /No runtime dependency changes/);
  }
});

test("resolves optional project and root peer providers", () => {
  for (const path of ["lib", "."]) {
    const lock = (version) => {
      const result = JSON.parse(v13Peer("18.2.0"));
      delete result.projects.lib.devDependencies;
      result.projects[path] ??= {};
      result.projects[path].optionalDependencies = { react: version };
      const entry = result.packages["react-dom@18.2.0"];
      entry.peerDependencies = { react: "^18.2.0" };
      entry.snapshots = [
        { peerDependencies: { react: { version: "18.2.0" } } },
        { peerDependencies: { react: { version: "18.3.1" } } },
      ];
      return JSON.stringify(result);
    };
    assert.match(
      runDiff(lock("18.2.0"), lock("18.3.1")),
      /Runtime dependency changes detected in: example/,
    );
  }
});

test("resolves catalog object peer providers without redundant versions", () => {
  const lock = (version) => {
    const result = JSON.parse(v13Peer("18.2.0"));
    result.projects.lib.devDependencies.react = { specifier: "catalog:peers" };
    result.settings = { catalogs: { peers: { react: version } } };
    const entry = result.packages["react-dom@18.2.0"];
    entry.peerDependencies = { react: "^18.2.0" };
    entry.snapshots = [
      { peerDependencies: { react: { version: "18.2.0" } } },
      { peerDependencies: { react: { version: "18.3.1" } } },
    ];
    return JSON.stringify(result);
  };
  assert.match(
    runDiff(lock("18.2.0"), lock("18.3.1")),
    /Runtime dependency changes detected in: example/,
  );
});

test("honors explicit peer bindings on v13 references", () => {
  for (const binding of ["18.3.1", { version: "18.3.1", with: { scheduler: "0.23.2" } }]) {
    const after = JSON.parse(v13Peer("18.2.0"));
    after.projects.lib.dependencies["react-dom"] = {
      specifier: "18.2.0",
      with: { react: binding },
    };
    after.packages["react-dom@18.2.0"].peerDependencies.react = "^18.2.0";
    const nested = typeof binding === "string" ? "" : "(scheduler@0.23.2)";
    const before = v9Peer.replace("(react@18.2.0)", `(react@18.3.1${nested})`);
    assert.match(runDiff(before, JSON.stringify(after)), /No runtime dependency changes/);
  }
});

test("detects lockfile-only optional runtime dependency updates", () => {
  const before = v13({ example: { specifier: "^1.0.0", version: "1.2.0" } }).replace(
    '"dependencies":',
    '"optionalDependencies":',
  );
  assert.match(
    runDiff(before, before.replace('"1.2.0"', '"1.3.0"')),
    /Runtime dependency changes detected in: example/,
  );
});

test("preserves and updates optional dependencies across v9 and v13 lockfiles", () => {
  const before = `lockfileVersion: '9.0'
importers:
  lib:
    dependencies:
      required:
        specifier: ^1.0.0
        version: 1.2.0
    optionalDependencies:
      optional:
        specifier: ^1.0.0
        version: 1.2.0
    devDependencies:
      tool:
        specifier: ^1.0.0
        version: 1.2.0
`;
  const after = v13({ required: { specifier: "^1.0.0", version: "1.2.0" } }).replace(
    '"devDependencies":',
    '"optionalDependencies": { "optional": { "specifier": "^1.0.0", "version": "1.2.0" } }, "devDependencies":',
  );
  assert.match(runDiff(before, after), /No runtime dependency changes/);
  assert.match(runDiff(after, before), /No runtime dependency changes/);
  assert.match(
    runDiff(
      before,
      before.replace(
        "optional:\n        specifier: ^1.0.0\n        version: 1.2.0",
        "optional:\n        specifier: ^1.0.0\n        version: 1.3.0",
      ),
    ),
    /Runtime dependency changes detected in: example/,
  );
  assert.match(
    runDiff(
      before,
      before.replace(
        "required:\n        specifier: ^1.0.0\n        version: 1.2.0",
        "required:\n        specifier: ^1.0.0\n        version: 1.3.0",
      ),
    ),
    /Runtime dependency changes detected in: example/,
  );
  assert.match(
    runDiff(
      before,
      before.replace(
        "tool:\n        specifier: ^1.0.0\n        version: 1.2.0",
        "tool:\n        specifier: ^1.0.0\n        version: 1.3.0",
      ),
    ),
    /No runtime dependency changes/,
  );
  const changed = after.replace(
    '"optional": { "specifier": "^1.0.0", "version": "1.2.0"',
    '"optional": { "specifier": "^1.0.0", "version": "1.3.0"',
  );
  assert.match(runDiff(before, changed), /Runtime dependency changes detected in: example/);
});
