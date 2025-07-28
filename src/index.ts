import clone from "just-clone";
import type z from "zod";

interface ZodDefWithShape {
  typeName?: string;
  type?: string;
  shape?: Record<string, z.ZodType> | (() => Record<string, z.ZodType>);
  items?: z.ZodType[];
  values?: unknown[];
  entries?: Record<string, unknown>;
  options?: z.ZodType[] | Map<string, z.ZodType>;
  left?: z.ZodType;
  right?: z.ZodType;
  innerType?: z.ZodType;
  base?: z.ZodType;
  schema?: z.ZodType;
  in?: z.ZodType;
  out?: z.ZodType;
  output?: z.ZodType;
  returns?: z.ZodType;
  getter?: () => z.ZodType;
  cls?: new (...args: unknown[]) => unknown;
  class?: new (...args: unknown[]) => unknown;
  value?: unknown;
  defaultValue?: unknown | (() => unknown);
  catchValue?: unknown | ((ctx: { error: Error }) => unknown);
  checks?: Array<{
    kind?: string;
    format?: string;
    value?: number;
    _zod?: { def?: { check?: string; value?: number } };
    constructor?: { name?: string };
  }>;
  parts?: (string | number | z.ZodType)[];
  minValue?: number;
  maxValue?: number;
  coerce?: boolean;
}

export function init<T extends z.ZodType>(schema: T): z.output<T> {
  const def = (schema._def ||
    (schema as z.ZodType & { def?: ZodDefWithShape }).def) as ZodDefWithShape;

  switch (def.typeName || def.type) {
    case "object": {
      const outputObject: Record<string, unknown> = {};
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      for (const [key, value] of Object.entries(
        shape as Record<string, z.ZodType>,
      )) {
        if (value) outputObject[key] = init(value as z.ZodType);
      }
      return outputObject as z.output<T>;
    }
    case "record":
      return {} as z.output<T>;
    case "string": {
      if (def.checks) {
        for (const check of def.checks || []) {
          if (check.format === "uuid") {
            return crypto.randomUUID() as z.output<T>;
          }
          // Handle IP address formats
          if (check.format === "ipv4") {
            return "0.0.0.0" as z.output<T>;
          }
          if (check.format === "ipv6") {
            return "::" as z.output<T>;
          }
        }
      }
      return "" as z.output<T>;
    }
    case "number":
      // Look at checks in order to return the first constraint value
      for (const check of def.checks || []) {
        if (
          check._zod?.def &&
          ["greater_than", "less_than"].includes(check._zod?.def?.check ?? "")
        ) {
          return check._zod.def.value as z.output<T>;
        }
      }
      return 0 as z.output<T>;
    case "bigint":
      return BigInt(0) as z.output<T>;
    case "boolean":
      return false as z.output<T>;
    case "date":
      return new Date() as z.output<T>;
    case "literal":
      return def.values?.[0] as z.output<T>;
    case "pipe": {
      // In v4, pipes need to run through the transformation
      const pipeInput = def.in ? init(def.in) : undefined;
      if (pipeInput !== undefined) {
        try {
          return schema.parse(pipeInput) as z.output<T>;
        } catch {
          return pipeInput as z.output<T>;
        }
      }
      return null as z.output<T>;
    }
    case "array":
      return [] as z.output<T>;
    case "tuple":
      return (def.items || []).map((item: z.ZodType) =>
        init(item),
      ) as z.output<T>;
    case "set":
      return new Set() as z.output<T>;
    case "map":
      return new Map() as z.output<T>;
    case "enum":
      if (def.entries) {
        const entries = def.entries;
        const values = Object.values(entries as Record<string, unknown>);
        const hasNumericValues = values.some((v) => typeof v === "number");
        if (hasNumericValues) {
          // This is a native enum - return the first numeric value
          return values.filter(
            (value) =>
              typeof (entries as Record<string, unknown>)[
                value as string | number
              ] !== "number",
          )[0] as z.output<T>;
        }
        // This is a regular enum - return the first value
        return values[0] as z.output<T>;
      }
      return null as z.output<T>;
    case "ZodNativeEnum": {
      // ref. https://github.com/colinhacks/zod/blob/6fe152f98a434a087c0f1ecbce5c52427bd816d3/src/helpers/util.ts#L28-L43
      // v3 uses def.values
      const values = (def.values || {}) as Record<string, unknown>;
      // For numeric enums, we want to return the numeric values, not the reverse mapped strings
      return Object.values(values).filter(
        (value) =>
          typeof (values as Record<string, unknown>)[
            value as string | number
          ] !== "number",
      )[0] as z.output<T>;
    }
    case "union": {
      const options = def.options as z.ZodType[] | undefined;
      return (options?.[0] ? init(options[0]) : undefined) as z.output<T>;
    }
    case "intersection": {
      const left = def.left ? init(def.left) : {};
      const right = def.right ? init(def.right) : {};
      return Object.assign(
        left as Record<string, unknown>,
        right,
      ) as z.output<T>;
    }
    case "function":
      return ((..._: unknown[]) => {
        const returnType = def.returns || def.output;
        return returnType ? init(returnType) : undefined;
      }) as z.output<T>;
    case "lazy": {
      const lazyType = def.getter ? def.getter() : def.innerType || def.base;
      return (lazyType ? init(lazyType) : undefined) as z.output<T>;
    }
    case "pipeline": {
      // For pipelines, we need to actually run through the pipeline
      // to get the final transformed result
      const input = def.in ? init(def.in) : undefined;
      try {
        return schema.parse(input) as z.output<T>;
      } catch {
        return input as z.output<T>;
      }
    }
    case "default": {
      const defaultInnerType = def.innerType || def.base;
      const innerDef =
        defaultInnerType?._def ||
        (defaultInnerType as z.ZodType & { def?: ZodDefWithShape })?.def;
      const isFunction =
        (innerDef as ZodDefWithShape)?.typeName === "ZodFunction" ||
        (innerDef as ZodDefWithShape)?.type === "function";
      // In v4, defaultValue is a getter property, not a function
      const defaultValue =
        typeof def.defaultValue === "function"
          ? def.defaultValue()
          : def.defaultValue;
      return (isFunction ? defaultValue : clone(defaultValue)) as z.output<T>;
    }
    case "nan":
      return Number.NaN as z.output<T>;
    case "null":
    case "any":
      return null as z.output<T>;
    case "optional": {
      // For optional types, we need to check if it's nullish (optional(nullable))
      // and if the deepest type has coerce
      const innerOptional = def.innerType || def.base;
      if (innerOptional) {
        return init(innerOptional) as z.output<T>;
      }
      return null as z.output<T>;
    }
    case "nullable": {
      // If the inner type has coerce, we should use it instead of returning null
      const innerTypeForNullable = def.innerType || def.base;
      if (innerTypeForNullable) {
        const innerDefForNullable =
          innerTypeForNullable._def ||
          (innerTypeForNullable as z.ZodType & { def?: ZodDefWithShape }).def;
        if (
          innerDefForNullable &&
          "coerce" in innerDefForNullable &&
          innerDefForNullable.coerce
        ) {
          return init(innerTypeForNullable) as z.output<T>;
        }
      }
      // For nullable without coerce, return null
      return null as z.output<T>;
    }
    case "undefined":
    case "void":
    case "never":
      return null as z.output<T>;
    case "unknown":
      return null as z.output<T>;
    case "symbol":
      return null as z.output<T>;
    case "file":
      // Return a minimal File object
      if (typeof File !== "undefined") {
        return new File([], "empty.txt", { type: "text/plain" }) as z.output<T>;
      }
      return null as z.output<T>;
    case "instanceof": {
      // For instanceof checks, try to create a minimal instance
      const cls = def.cls || def.class;
      if (cls === File && typeof File !== "undefined") {
        return new File([], "empty.txt", { type: "text/plain" }) as z.output<T>;
      }
      // For other classes, return null
      return null as z.output<T>;
    }
    case "branded": {
      // For branded types, get the value from the underlying type
      const brandedType = def.type || def.base;
      return (
        brandedType && typeof brandedType !== "string"
          ? init(brandedType)
          : undefined
      ) as z.output<T>;
    }
    case "catch":
      // For catch types, try to get the value from the inner type
      // If it fails, use the catch value
      try {
        const innerType = def.innerType || def.base;
        const innerValue = innerType ? init(innerType) : undefined;
        return schema.parse(innerValue) as z.output<T>;
      } catch {
        // Get the catch value
        const catchValue =
          typeof def.catchValue === "function"
            ? def.catchValue({ error: new Error() })
            : def.catchValue;
        return catchValue as z.output<T>;
      }
    case "template_literal":
      // For template literals, concatenate parts
      if (def.parts) {
        return (def.parts as (string | number | z.ZodType)[])
          .map((part) => {
            if (typeof part === "string" || typeof part === "number") {
              return part;
            }
            // For schema parts, init with empty string
            return "";
          })
          .join("") as z.output<T>;
      }
      return "" as z.output<T>;
    case "readonly": {
      // For readonly, init the inner type
      const readonlyInner = def.innerType || def.base;
      return (readonlyInner ? init(readonlyInner) : undefined) as z.output<T>;
    }
    case "custom": {
      return null as z.output<T>;
    }
    default:
      return undefined as unknown as z.output<T>;
  }
}

export function empty<T extends z.ZodType>(schema: T): z.input<T> {
  const def = (schema._def ||
    (schema as z.ZodType & { def?: ZodDefWithShape }).def) as ZodDefWithShape;
  switch (def.typeName || def.type) {
    case "object": {
      const outputObject: Record<string, unknown> = {};
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      for (const [key, value] of Object.entries(
        shape as Record<string, z.ZodType>,
      )) {
        if (value) outputObject[key] = empty(value as z.ZodType);
      }
      return outputObject as z.input<T>;
    }
    case "record":
      return {} as z.input<T>;
    case "array":
      return [] as z.input<T>;
    case "tuple":
      return (def.items || []).map((item: z.ZodType) =>
        empty(item),
      ) as z.input<T>;
    case "set":
      return new Set() as z.input<T>;
    case "map":
      return new Map() as z.input<T>;
    case "union": {
      const options = def.options as z.ZodType[] | undefined;
      return (options?.[0] ? empty(options[0]) : null) as z.input<T>;
    }
    case "intersection": {
      const left = def.left ? empty(def.left) : {};
      const right = def.right ? empty(def.right) : {};
      return Object.assign(
        left as Record<string, unknown>,
        right,
      ) as z.input<T>;
    }
    case "lazy": {
      const lazyType = def.getter ? def.getter() : def.innerType || def.base;
      return (lazyType ? empty(lazyType) : null) as z.input<T>;
    }
    case "pipeline": {
      const pipelineIn = def.in;
      return (pipelineIn ? empty(pipelineIn) : null) as z.input<T>;
    }
    case "nullable":
    case "optional": {
      const innerType = def.innerType || def.base;
      return (innerType ? empty(innerType) : null) as z.input<T>;
    }
    case "pipe": {
      const schemaType = def.schema || def.in;
      return (schemaType ? empty(schemaType) : null) as z.input<T>;
    }
    case "literal":
      return def.values?.[0] as z.input<T>;
    case "nan":
      return Number.NaN as z.input<T>;
    case "default": {
      const defaultInnerType = def.innerType || def.base;
      const innerDef =
        defaultInnerType?._def ||
        (defaultInnerType as z.ZodType & { def?: ZodDefWithShape })?.def;
      const isFunction =
        (innerDef as ZodDefWithShape)?.typeName === "ZodFunction" ||
        (innerDef as ZodDefWithShape)?.type === "function";
      // In v4, defaultValue is a getter property, not a function
      const defaultValue =
        typeof def.defaultValue === "function"
          ? def.defaultValue()
          : def.defaultValue;
      return (isFunction ? defaultValue : clone(defaultValue)) as z.input<T>;
    }
    case "symbol":
      return null as z.input<T>;
    case "file":
      return null as z.input<T>;
    case "instanceof":
      return null as z.input<T>;
    case "branded": {
      const brandedInner = def.type || def.base;
      return (
        brandedInner && typeof brandedInner !== "string"
          ? empty(brandedInner)
          : null
      ) as z.input<T>;
    }
    case "catch": {
      const catchInner = def.innerType || def.base;
      return (catchInner ? empty(catchInner) : null) as z.input<T>;
    }
    case "template_literal":
      return null as z.input<T>;
    case "readonly": {
      const readonlyInner = def.innerType || def.base;
      return (readonlyInner ? empty(readonlyInner) : null) as z.input<T>;
    }
    case "prefault":
      return undefined as z.input<T>;
    default:
      return null as z.input<T>;
  }
}
