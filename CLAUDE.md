# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`zod-empty` is a TypeScript utility library that generates minimum/default data from Zod schemas. It provides two main functions:
- `init()`: Generates minimal valid data (empty strings, zeros, empty arrays)
- `empty()`: Generates null/empty values

Primary use case is generating default values for forms, particularly with React Hook Form.

## Common Development Commands

This repository uses **pnpm** (pinned via the `packageManager` field). Do not use npm or yarn.

### Build
```bash
pnpm build           # Build both CJS and ESM formats with tsdown
```

### Testing
```bash
pnpm test            # Run tests once with Vitest
pnpm test:watch      # Run tests in watch mode
pnpm coverage        # Run tests with coverage report
```

### Code Quality
```bash
pnpm check           # Format and lint with Biome
pnpm check:force     # Format and lint with unsafe fixes
```

### Release
```bash
pnpm changeset       # Record a changeset describing your change
pnpm release         # Build and publish (used by CI/CD)
```

## Architecture

The library is a single-module TypeScript project with dual module format support (CommonJS and ES Modules).

### Core Implementation
- `/src/index.ts`: Contains the main `init()` and `empty()` functions that recursively process Zod schemas
- Uses pattern matching on Zod schema types to generate appropriate default values
- Handles complex schemas including unions, intersections, optionals, nullables, and nested structures

### Build System
- TypeScript compiles to both `/dist/cjs` and `/dist/esm` directories
- Separate tsconfig files for each module format
- Package exports configured for proper module resolution

### Testing
- Comprehensive test suite in `/src/index.spec.ts` covering all Zod types
- Uses Vitest for testing with coverage support
- Tests verify both `init()` and `empty()` behavior for each schema type

### Release Process
- Versioning and publishing are driven by changesets
- A PR that changes the published package must add a changeset with `pnpm changeset`. Changes that do not reach consumers (CI, repo tooling, docs) need no changeset at all — nothing enforces their presence, and the Release workflow simply finds nothing to publish
- On push to `main`, the Release workflow opens or updates a `chore: release` PR; merging that PR publishes to npm and creates a GitHub Release
- Publishing uses npm OIDC trusted publishing with provenance, so no npm token is involved. `registry-url` must stay off `actions/setup-node` in `release.yml` — it writes an `.npmrc` with an empty auth token and breaks OIDC