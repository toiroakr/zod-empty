import clone from "just-clone";
import type { ZodTypeAny, input, output } from "zod";

export function init<T extends ZodTypeAny>(schema: T): output<T> {
  const def = schema._def;
  if (!def.coerce && schema.isNullable() && def.typeName !== "ZodDefault") {
    return null;
  }

  switch (def.typeName) {
    case "ZodObject": {
      const outputObject: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(def.shape())) {
        outputObject[key] = init(value as ZodTypeAny);
      }
      return outputObject;
    }
    case "ZodRecord":
      return {};
    case "ZodString": {
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "uuid") {
            return crypto.randomUUID();
          }
        }
      }
      return "";
    }
    case "ZodNumber":
      for (const check of def.checks || []) {
        if (["min", "max"].includes(check.kind)) {
          return check.value;
        }
      }
      return 0;
    case "ZodBigInt":
      return 0;
    case "ZodBoolean":
      return false;
    case "ZodDate":
      return new Date();
    case "ZodLiteral":
      return def.value;
    case "ZodEffects":
      return init(def.schema);
    case "ZodArray":
      return [];
    case "ZodTuple":
      return def.items.map((item: ZodTypeAny) => init(item));
    case "ZodSet":
      return new Set();
    case "ZodMap":
      return new Map();
    case "ZodEnum":
      return def.values[0];
    case "ZodNativeEnum":
      // ref. https://github.com/colinhacks/zod/blob/6fe152f98a434a087c0f1ecbce5c52427bd816d3/src/helpers/util.ts#L28-L43
      return Object.values(def.values).filter(
        (value) => typeof def.values[value as any] !== "number",
      )[0];
    case "ZodUnion":
      return init(def.options[0]);
    case "ZodDiscriminatedUnion":
      return init(Array.from(def.options.values() as any[])[0]);
    case "ZodIntersection":
      return Object.assign(init(def.left) as any, init(def.right));
    case "ZodFunction":
      return (..._: any[]) => init(def.returns);
    case "ZodLazy":
      return init(def.getter());
    case "ZodPipeline":
      return init(def.in);
    case "ZodDefault":
      return def.innerType._def.typeName === "ZodFunction"
        ? def.defaultValue()
        : clone(def.defaultValue());
    case "ZodNaN":
      return Number.NaN;
    case "ZodNull":
    case "ZodAny":
      return null;
    case "ZodOptional":
      return init(def.innerType);
    // case "ZodUndefined":
    // case "ZodVoid":
    // case "ZodUnknown":
    // case "ZodNever":
    default:
      return undefined;
  }
}

export function empty<T extends ZodTypeAny>(schema: T): input<T> {
  const def = schema._def;
  switch (def.typeName) {
    case "ZodObject": {
      const outputObject: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(def.shape())) {
        outputObject[key] = empty(value as ZodTypeAny);
      }
      return outputObject;
    }
    case "ZodRecord":
      return {};
    case "ZodArray":
      return [];
    case "ZodTuple":
      return def.items.map((item: ZodTypeAny) => empty(item));
    case "ZodSet":
      return new Set();
    case "ZodMap":
      return new Map();
    case "ZodUnion":
      return empty(def.options[0]);
    case "ZodDiscriminatedUnion":
      return empty(Array.from(def.options.values() as any[])[0]);
    case "ZodIntersection":
      return Object.assign(empty(def.left) as any, empty(def.right));
    case "ZodLazy":
      return empty(def.getter());
    case "ZodPipeline":
      return empty(def.in);
    case "ZodNullable":
    case "ZodOptional":
      return empty(def.innerType);
    case "ZodEffects":
      return empty(def.schema);
    case "ZodLiteral":
      return def.value;
    case "ZodNaN":
      return Number.NaN;
    case "ZodDefault":
      return def.innerType._def.typeName === "ZodFunction"
        ? def.defaultValue()
        : clone(def.defaultValue());
    default:
      return null;
  }
}
