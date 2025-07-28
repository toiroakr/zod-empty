# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`zod-empty` is a TypeScript utility library that generates minimum/default data from Zod schemas. It provides two main functions:
- `init()`: Generates minimal valid data (empty strings, zeros, empty arrays)
- `empty()`: Generates null/empty values

Primary use case is generating default values for forms, particularly with React Hook Form.

## Common Development Commands

### Build
```bash
npm run build        # Build both CJS and ESM formats
npm run build:cjs    # Build CommonJS format only
npm run build:esm    # Build ES Module format only
```

### Testing
```bash
npm test             # Run tests with Vitest
npm run coverage     # Run tests with coverage report
```

### Code Quality
```bash
npm run check        # Format and lint with Biome
npm run check:force  # Format and lint with unsafe fixes
```

### Release
```bash
npm run release      # Build and publish (used by CI/CD)
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
- Automated semantic release via GitHub Actions
- Commits following conventional commit format trigger releases
- Automatic changelog generation and npm publishing