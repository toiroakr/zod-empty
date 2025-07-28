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
    case "ZodObject":
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
    case "ZodRecord":
    case "record":
      return {} as z.output<T>;
    case "ZodString":
    case "string": {
      if (def.checks) {
        for (const check of def.checks || []) {
          // v3 uses check.kind === "uuid", v4 uses check.format === "uuid"
          if (check.kind === "uuid" || check.format === "uuid") {
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
    case "ZodNumber":
    case "number":
      // Look at checks in order to return the first constraint value
      for (const check of def.checks || []) {
        // v3 has check.kind and check.value
        if (["max", "min"].includes(check.kind ?? "")) {
          return check.value as z.output<T>;
        }
        // v4 uses _zod.def structure
        if (
          check._zod?.def &&
          ["greater_than", "less_than"].includes(check._zod?.def?.check ?? "")
        ) {
          return check._zod.def.value as z.output<T>;
        }
        return undefined as unknown as z.output<T>;
      }
      return 0 as z.output<T>;
    case "ZodBigInt":
    case "bigint":
      return BigInt(0) as z.output<T>;
    case "ZodBoolean":
    case "boolean":
      return false as z.output<T>;
    case "ZodDate":
    case "date":
      return new Date() as z.output<T>;
    case "ZodLiteral":
    case "literal":
      // v3 uses def.value, v4 uses def.values[0]
      return (
        def.value !== undefined ? def.value : def.values?.[0]
      ) as z.output<T>;
    case "ZodEffects": {
      // For v3 effects/transforms, we need to run through the transformation
      const baseValue = def.schema ? init(def.schema) : undefined;
      if (baseValue !== undefined) {
        try {
          return schema.parse(baseValue) as z.output<T>;
        } catch {
          return baseValue as z.output<T>;
        }
      }
      return undefined as unknown as z.output<T>;
    }
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
      return undefined as unknown as z.output<T>;
    }
    case "ZodArray":
    case "array":
      return [] as z.output<T>;
    case "ZodTuple":
    case "tuple":
      return (def.items || []).map((item: z.ZodType) =>
        init(item),
      ) as z.output<T>;
    case "ZodSet":
    case "set":
      return new Set() as z.output<T>;
    case "ZodMap":
    case "map":
      return new Map() as z.output<T>;
    case "ZodEnum":
    case "enum":
      // v3 uses def.values array, v4 uses def.entries object
      if (def.values) {
        return def.values[0] as z.output<T>;
      }
      if (def.entries) {
        // In v4, both enum and nativeEnum use type "enum", so we need to detect native enums
        const entries = def.entries;
        const values = Object.values(entries as Record<string, unknown>);
        // Check if this is a native enum by looking for numeric values
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
      return undefined as unknown as z.output<T>;
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
    case "ZodUnion":
    case "union": {
      const options = def.options as z.ZodType[] | undefined;
      return (options?.[0] ? init(options[0]) : undefined) as z.output<T>;
    }
    case "ZodDiscriminatedUnion": {
      let option: z.ZodType | undefined;
      if (Array.isArray(def.options)) {
        option = def.options[0];
      } else if (def.options) {
        option = Array.from(def.options.values() as Iterable<z.ZodType>)[0];
      }
      return (option ? init(option) : undefined) as z.output<T>;
    }
    case "ZodIntersection":
    case "intersection": {
      const left = def.left ? init(def.left) : {};
      const right = def.right ? init(def.right) : {};
      return Object.assign(
        left as Record<string, unknown>,
        right,
      ) as z.output<T>;
    }
    case "ZodFunction":
    case "function":
      return ((..._: unknown[]) => {
        const returnType = def.returns || def.output;
        return returnType ? init(returnType) : undefined;
      }) as z.output<T>;
    case "ZodLazy":
    case "lazy": {
      const lazyType = def.getter ? def.getter() : def.innerType || def.base;
      return (lazyType ? init(lazyType) : undefined) as z.output<T>;
    }
    case "ZodPipeline":
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
    case "ZodDefault":
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
    case "ZodNaN":
    case "nan":
      return Number.NaN as z.output<T>;
    case "ZodNull":
    case "null":
    case "ZodAny":
    case "any":
      return null as z.output<T>;
    case "ZodOptional":
    case "optional": {
      // For optional types, we need to check if it's nullish (optional(nullable))
      // and if the deepest type has coerce
      const innerOptional = def.innerType || def.base;
      if (innerOptional) {
        return init(innerOptional) as z.output<T>;
      }
      return undefined as unknown as z.output<T>;
    }
    case "ZodNullable":
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
    case "ZodUndefined":
    case "undefined":
    case "ZodVoid":
    case "void":
    case "ZodNever":
    case "never":
      return undefined as unknown as z.output<T>;
    case "ZodUnknown":
    case "unknown":
      return undefined as unknown as z.output<T>;
    case "ZodSymbol":
    case "symbol":
      return undefined as unknown as z.output<T>;
    case "ZodFile":
    case "file":
      // Return a minimal File object
      if (typeof File !== "undefined") {
        return new File([], "empty.txt", { type: "text/plain" }) as z.output<T>;
      }
      return undefined as unknown as z.output<T>;
    case "ZodInstanceOf":
    case "instanceof": {
      // For instanceof checks, try to create a minimal instance
      const cls = def.cls || def.class;
      if (cls === File && typeof File !== "undefined") {
        return new File([], "empty.txt", { type: "text/plain" }) as z.output<T>;
      }
      // For other classes, return undefined
      return undefined as unknown as z.output<T>;
    }
    case "ZodBranded":
    case "branded": {
      // For branded types, get the value from the underlying type
      const brandedType = def.type || def.base;
      return (
        brandedType && typeof brandedType !== "string"
          ? init(brandedType)
          : undefined
      ) as z.output<T>;
    }
    case "ZodCatch":
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
    case "ZodTemplateLiteral":
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
    case "ZodReadonly":
    case "readonly": {
      // For readonly, init the inner type
      const readonlyInner = def.innerType || def.base;
      return (readonlyInner ? init(readonlyInner) : undefined) as z.output<T>;
    }
    case "ZodPrefault":
    case "prefault": {
      // For prefault, always return the default value
      const defaultValue =
        typeof def.defaultValue === "function"
          ? def.defaultValue()
          : def.defaultValue;
      return defaultValue as z.output<T>;
    }
    default:
      return undefined as unknown as z.output<T>;
  }
}

export function empty<T extends z.ZodType>(schema: T): z.input<T> {
  const def = (schema._def ||
    (schema as z.ZodType & { def?: ZodDefWithShape }).def) as ZodDefWithShape;
  switch (def.typeName || def.type) {
    case "ZodObject":
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
    case "ZodRecord":
    case "record":
      return {} as z.input<T>;
    case "ZodArray":
    case "array":
      return [] as z.input<T>;
    case "ZodTuple":
    case "tuple":
      return (def.items || []).map((item: z.ZodType) =>
        empty(item),
      ) as z.input<T>;
    case "ZodSet":
    case "set":
      return new Set() as z.input<T>;
    case "ZodMap":
    case "map":
      return new Map() as z.input<T>;
    case "ZodUnion":
    case "union": {
      const options = def.options as z.ZodType[] | undefined;
      return (options?.[0] ? empty(options[0]) : null) as z.input<T>;
    }
    case "ZodDiscriminatedUnion": {
      let option: z.ZodType | undefined;
      if (Array.isArray(def.options)) {
        option = def.options[0];
      } else if (def.options) {
        option = Array.from(def.options.values() as Iterable<z.ZodType>)[0];
      }
      return (option ? empty(option) : null) as z.input<T>;
    }
    case "ZodIntersection":
    case "intersection": {
      const left = def.left ? empty(def.left) : {};
      const right = def.right ? empty(def.right) : {};
      return Object.assign(
        left as Record<string, unknown>,
        right,
      ) as z.input<T>;
    }
    case "ZodLazy":
    case "lazy": {
      const lazyType = def.getter ? def.getter() : def.innerType || def.base;
      return (lazyType ? empty(lazyType) : null) as z.input<T>;
    }
    case "ZodPipeline":
    case "pipeline": {
      const pipelineIn = def.in;
      return (pipelineIn ? empty(pipelineIn) : null) as z.input<T>;
    }
    case "ZodNullable":
    case "nullable":
    case "ZodOptional":
    case "optional": {
      const innerType = def.innerType || def.base;
      return (innerType ? empty(innerType) : null) as z.input<T>;
    }
    case "ZodEffects":
    case "pipe": {
      const schemaType = def.schema || def.in;
      return (schemaType ? empty(schemaType) : null) as z.input<T>;
    }
    case "ZodLiteral":
    case "literal":
      // v3 uses def.value, v4 uses def.values[0]
      return (
        def.value !== undefined ? def.value : def.values?.[0]
      ) as z.input<T>;
    case "ZodNaN":
    case "nan":
      return Number.NaN as z.input<T>;
    case "ZodDefault":
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
    case "ZodSymbol":
    case "symbol":
      return null as z.input<T>;
    case "ZodFile":
    case "file":
      return null as z.input<T>;
    case "ZodInstanceOf":
    case "instanceof":
      return null as z.input<T>;
    case "ZodBranded":
    case "branded": {
      const brandedInner = def.type || def.base;
      return (
        brandedInner && typeof brandedInner !== "string"
          ? empty(brandedInner)
          : null
      ) as z.input<T>;
    }
    case "ZodCatch":
    case "catch": {
      const catchInner = def.innerType || def.base;
      return (catchInner ? empty(catchInner) : null) as z.input<T>;
    }
    case "ZodTemplateLiteral":
    case "template_literal":
      return null as z.input<T>;
    case "ZodReadonly":
    case "readonly": {
      const readonlyInner = def.innerType || def.base;
      return (readonlyInner ? empty(readonlyInner) : null) as z.input<T>;
    }
    case "ZodPrefault":
    case "prefault": {
      // For prefault in empty(), return the default value
      const defaultValue =
        typeof def.defaultValue === "function"
          ? def.defaultValue()
          : def.defaultValue;
      return defaultValue as z.input<T>;
    }
    default:
      return null as z.input<T>;
  }
}
