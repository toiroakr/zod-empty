/* eslint @typescript-eslint/no-explicit-any: off */
import clone from "just-clone";
import type { ZodTypeAny } from "zod";

function make<T extends ZodTypeAny>(schema: T): unknown {
  const def = schema._def;

  switch (def.typeName) {
    case "ZodObject":
      const outputObject: Record<string, any> = {};
      Object.entries(def.shape()).forEach(
        ([key, value]) => (outputObject[key] = make(value as ZodTypeAny))
      );
      return outputObject;
    case "ZodRecord":
      return {};
    case "ZodString":
      return "";
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
      return make(def.schema);
    case "ZodArray":
      return [];
    case "ZodTuple":
      return def.items.map((item: ZodTypeAny) => make(item));
    case "ZodSet":
      return new Set();
    case "ZodMap":
      return new Map();
    case "ZodEnum":
      return def.values[0];
    case "ZodNativeEnum":
      // ref. https://github.com/colinhacks/zod/blob/6fe152f98a434a087c0f1ecbce5c52427bd816d3/src/helpers/util.ts#L28-L43
      return Object.values(def.values).filter(
        (value) => typeof def.values[value as any] !== "number"
      )[0];
    case "ZodUnion":
      return make(def.options[0]);
    case "ZodDiscriminatedUnion":
      return make(Array.from(def.options.values() as any[])[0]);
    case "ZodIntersection":
      return Object.assign(make(def.left) as any, make(def.right));
    case "ZodFunction":
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return (..._: any[]) => make(def.returns);
    case "ZodDefault":
      return def.innerType._def.typeName === "ZodFunction"
        ? def.defaultValue()
        : clone(def.defaultValue());
    case "ZodNaN":
      return NaN;
    case "ZodNull":
    case "ZodNullable":
      return null;
    case "ZodUndefined":
    case "ZodVoid":
    case "ZodOptional":
    case "ZodAny":
    case "ZodUnknown":
    case "ZodNever":
    default:
      return undefined;
  }
}
function init<R = unknown>(schema: any): R {
  return make(schema) as R;
}
export default init;
