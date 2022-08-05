import { afterEach, beforeEach, expect, describe, it, vi } from "vitest";
import z from "zod";
import init from "./index";

describe("make empty", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("string", () => {
    expect(init(z.string())).toBe("");
  });

  it("number", () => {
    expect(init(z.number())).toBe(0);
    expect(init(z.number().min(10))).toBe(10);
    expect(init(z.number().max(100))).toBe(100);
    expect(init(z.number().min(10).max(100))).toBe(10);
    expect(init(z.number().max(100).min(10))).toBe(100);
  });

  it("bigint", () => {
    expect(init(z.bigint())).toBe(0);
  });

  it("boolean", () => {
    expect(init(z.boolean())).toBe(false);
  });

  it("date", () => {
    expect(init(z.date())).toEqual(new Date());
  });

  it("literal", () => {
    expect(init(z.literal("literal"))).toBe("literal");
  });

  it("array", () => {
    expect(init(z.array(z.string()))).toEqual([]);
  });

  it("transform", () => {
    expect(init(z.string().transform((val) => val.length))).toBe("");
  });

  it("object", () => {
    expect(init(z.object({ foo: z.string(), bar: z.number() }))).toEqual({
      foo: "",
      bar: 0,
    });
  });

  it("record", () => {
    expect(init(z.record(z.string(), z.number()))).toEqual({});
  });

  it("enum", () => {
    expect(init(z.enum([`light`, `dark`]))).toBe("light");
  });

  it("nativeEnum", () => {
    enum NativeEnum {
      a = 1,
      b = 2,
    }

    expect(init(z.nativeEnum(NativeEnum))).toBe(NativeEnum.a);
  });

  it("union", () => {
    expect(init(z.union([z.string(), z.number()]))).toBe("");
  });

  it("discriminatedUnion", () => {
    expect(
      init(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("a"), a: z.string() }),
          z.object({ type: z.literal("b"), b: z.string() }),
        ])
      )
    ).toEqual({ type: "a", a: "" });
  });

  it("intersection", () => {
    const Person = z.object({
      name: z.string(),
      age: z.number(),
    });
    const Employee = z.object({
      role: z.string(),
      salary: z.number(),
    });

    expect(init(z.intersection(Person, Employee))).toEqual({
      name: "",
      age: 0,
      role: "",
      salary: 0,
    });
  });

  // Could there be a more appropriate test?
  it("function", () => {
    const schema = z
      .function()
      .args(z.number(), z.string())
      .returns(z.boolean());
    type SchemaType = z.infer<typeof schema>;
    expect(init<SchemaType>(schema)(0, "")).toBe(false);
  });

  it("tuple", () => {
    expect(init(z.tuple([z.string(), z.number()]))).toEqual(["", 0]);
  });

  it("set", () => {
    expect(init(z.set(z.string()))).toEqual(new Set());
  });

  it("map", () => {
    expect(init(z.map(z.string(), z.number()))).toEqual(new Map());
  });

  it("default", () => {
    expect(init(z.string().default("default value"))).toBe("default value");
    expect(init(z.number().default(2))).toBe(2);
    expect(init(z.boolean().default(true))).toBe(true);
    expect(init(z.null().default(null))).toBeNull();
    expect(init(z.any().default({ default: true }))).toEqual({ default: true });

    const defaultFunction = (s: string) => s?.length;
    expect(
      init(
        z
          .function()
          .args(z.string())
          .returns(z.number())
          .default(() => defaultFunction)
      )
    ).toBe(defaultFunction);

    // return value for object/array/set/map not strict equal to default parameter.
    const defaultObject = { default: true };
    expect(init(z.any().default(defaultObject)) === defaultObject).toBe(false);
  });

  it("nan", () => {
    expect(init(z.nan())).toBeNaN();
  });

  it("null", () => {
    expect(init(z.null())).toBeNull();
  });

  it("nullable", () => {
    expect(init(z.string().nullable())).toBeNull();
  });

  it("nullish", () => {
    expect(init(z.string().nullish())).toBeNull();
  });

  it("optional", () => {
    expect(init(z.string().optional())).toBeUndefined();
  });

  it("undefined", () => {
    expect(init(z.undefined())).toBeUndefined();
  });

  it("void", () => {
    expect(init(z.void())).toBeUndefined();
  });

  it("any", () => {
    expect(init(z.any())).toBeUndefined();
  });

  it("unknown", () => {
    expect(init(z.unknown())).toBeUndefined();
  });

  it("never", () => {
    expect(init(z.never())).toBeUndefined();
  });
});
