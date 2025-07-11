import clone from "just-clone";
import type z from "zod";

export function init<T extends z.ZodType>(schema: T): z.output<T> {
  const def: any = schema._def || (schema as any).def;

  switch (def.typeName || def.type) {
    case "ZodObject":
    case "object": {
      const outputObject: Record<string, unknown> = {};
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      for (const [key, value] of Object.entries(shape)) {
        outputObject[key] = init(value as z.ZodType);
      }
      return outputObject as z.output<T>;
    }
    case "ZodRecord":
    case "record":
      return {} as z.output<T>;
    case "ZodString":
    case "string": {
      if (def.checks) {
        for (const check of def.checks) {
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
        if (check.kind === "max" || check.kind === "min") {
          return check.value as z.output<T>;
        }
        // v4 uses _zod.def structure
        if (check._zod?.def?.value !== undefined) {
          return check._zod.def.value as z.output<T>;
        }
        // v4 alternative: check the check type and use schema properties
        const checkStr = check.constructor?.name || check.toString();
        if (
          checkStr.includes("GreaterThan") &&
          "minValue" in schema &&
          (schema as any).minValue !== Number.NEGATIVE_INFINITY
        ) {
          return (schema as any).minValue as z.output<T>;
        }
        if (
          checkStr.includes("LessThan") &&
          "maxValue" in schema &&
          (schema as any).maxValue !== Number.POSITIVE_INFINITY
        ) {
          return (schema as any).maxValue as z.output<T>;
        }
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
      const baseValue = init(def.schema);
      try {
        return schema.parse(baseValue) as z.output<T>;
      } catch {
        return baseValue as z.output<T>;
      }
    }
    case "pipe": {
      // In v4, pipes need to run through the transformation
      const pipeInput = init(def.in);
      try {
        return schema.parse(pipeInput) as z.output<T>;
      } catch {
        return pipeInput as z.output<T>;
      }
    }
    case "ZodArray":
    case "array":
      return [] as z.output<T>;
    case "ZodTuple":
    case "tuple":
      return def.items.map((item: z.ZodType) => init(item)) as z.output<T>;
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
        const values = Object.values(entries);
        // Check if this is a native enum by looking for numeric values
        const hasNumericValues = values.some((v) => typeof v === "number");
        if (hasNumericValues) {
          // This is a native enum - return the first numeric value
          return values.filter(
            (value) => typeof entries[value as any] !== "number",
          )[0] as z.output<T>;
        }
        // This is a regular enum - return the first value
        return values[0] as z.output<T>;
      }
      return undefined as z.output<T>;
    case "ZodNativeEnum": {
      // ref. https://github.com/colinhacks/zod/blob/6fe152f98a434a087c0f1ecbce5c52427bd816d3/src/helpers/util.ts#L28-L43
      // v3 uses def.values
      const values = def.values;
      // For numeric enums, we want to return the numeric values, not the reverse mapped strings
      return Object.values(values).filter(
        (value) => typeof values[value as any] !== "number",
      )[0] as z.output<T>;
    }
    case "ZodUnion":
    case "union":
      return init(def.options[0]) as z.output<T>;
    case "ZodDiscriminatedUnion":
      return init(
        Array.isArray(def.options)
          ? def.options[0]
          : Array.from(def.options.values() as any[])[0],
      ) as z.output<T>;
    case "ZodIntersection":
    case "intersection":
      return Object.assign(
        init(def.left) as any,
        init(def.right),
      ) as z.output<T>;
    case "ZodFunction":
    case "function":
      return ((..._: any[]) => init(def.returns || def.output)) as z.output<T>;
    case "ZodLazy":
    case "lazy":
      return init(def.getter()) as z.output<T>;
    case "ZodPipeline":
    case "pipeline": {
      // For pipelines, we need to actually run through the pipeline
      // to get the final transformed result
      const input = init(def.in);
      try {
        return schema.parse(input) as z.output<T>;
      } catch {
        return input as z.output<T>;
      }
    }
    case "ZodDefault":
    case "default": {
      const innerType = def.innerType || def.base;
      const innerDef = innerType?._def || innerType?.def;
      const isFunction =
        innerDef?.typeName === "ZodFunction" || innerDef?.type === "function";
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
      return undefined as z.output<T>;
    }
    case "ZodNullable":
    case "nullable": {
      // If the inner type has coerce, we should use it instead of returning null
      const innerTypeForNullable = def.innerType || def.base;
      if (innerTypeForNullable) {
        const innerDefForNullable =
          innerTypeForNullable._def || innerTypeForNullable.def;
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
      return undefined as z.output<T>;
    case "ZodUnknown":
    case "unknown":
      return undefined as z.output<T>;
    case "ZodSymbol":
    case "symbol":
      return undefined as z.output<T>;
    case "ZodFile":
    case "file":
      // Return a minimal File object
      if (typeof File !== "undefined") {
        return new File([], "empty.txt", { type: "text/plain" }) as z.output<T>;
      }
      return undefined as z.output<T>;
    case "ZodInstanceOf":
    case "instanceof": {
      // For instanceof checks, try to create a minimal instance
      const cls = def.cls || def.class;
      if (cls === File && typeof File !== "undefined") {
        return new File([], "empty.txt", { type: "text/plain" }) as z.output<T>;
      }
      // For other classes, return undefined
      return undefined as z.output<T>;
    }
    case "ZodBranded":
    case "branded":
      // For branded types, get the value from the underlying type
      return init(def.type || def.base) as z.output<T>;
    case "ZodCatch":
    case "catch":
      // For catch types, try to get the value from the inner type
      // If it fails, use the catch value
      try {
        const innerValue = init(def.innerType || def.base);
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
        return def.parts
          .map((part: any) => {
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
    case "readonly":
      // For readonly, init the inner type
      return init(def.innerType || def.base) as z.output<T>;
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
      return undefined as z.output<T>;
  }
}

export function empty<T extends z.ZodType>(schema: T): z.input<T> {
  const def: any = schema._def || (schema as any).def;
  switch (def.typeName || def.type) {
    case "ZodObject":
    case "object": {
      const outputObject: Record<string, unknown> = {};
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      for (const [key, value] of Object.entries(shape)) {
        outputObject[key] = empty(value as z.ZodType);
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
      return def.items.map((item: z.ZodType) => empty(item)) as z.input<T>;
    case "ZodSet":
    case "set":
      return new Set() as z.input<T>;
    case "ZodMap":
    case "map":
      return new Map() as z.input<T>;
    case "ZodUnion":
    case "union":
      return empty(def.options[0]) as z.input<T>;
    case "ZodDiscriminatedUnion":
      return empty(
        Array.isArray(def.options)
          ? def.options[0]
          : Array.from(def.options.values() as any[])[0],
      ) as z.input<T>;
    case "ZodIntersection":
    case "intersection":
      return Object.assign(
        empty(def.left) as any,
        empty(def.right),
      ) as z.input<T>;
    case "ZodLazy":
    case "lazy":
      return empty(def.getter()) as z.input<T>;
    case "ZodPipeline":
    case "pipeline":
      return empty(def.in) as z.input<T>;
    case "ZodNullable":
    case "nullable":
    case "ZodOptional":
    case "optional":
      return empty(def.innerType || def.base) as z.input<T>;
    case "ZodEffects":
    case "pipe":
      return empty(def.schema || def.in) as z.input<T>;
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
      const innerType = def.innerType || def.base;
      const innerDef = innerType?._def || innerType?.def;
      const isFunction =
        innerDef?.typeName === "ZodFunction" || innerDef?.type === "function";
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
    case "branded":
      return empty(def.type || def.base) as z.input<T>;
    case "ZodCatch":
    case "catch":
      return empty(def.innerType || def.base) as z.input<T>;
    case "ZodTemplateLiteral":
    case "template_literal":
      return null as z.input<T>;
    case "ZodReadonly":
    case "readonly":
      return empty(def.innerType || def.base) as z.input<T>;
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
