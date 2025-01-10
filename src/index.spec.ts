import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";
import { empty, init } from "./index";

describe("make empty", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("string", () => {
    const schema = z.string();
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();
  });

  it("uuid", () => {
    const schema = z.string().uuid();
    expect(init(schema).length).toBe(36);
    expect(empty(schema)).toBeNull();
  });

  it.each([
    ["", z.number(), 0],
    ["10-", z.number().min(10), 10],
    ["-100", z.number().max(100), 100],
    ["10-100", z.number().min(10).max(100), 10],
    ["10-100 (reverse)", z.number().max(100).min(10), 100],
  ])("number %s", (_, schema, initExpect) => {
    expect(init(schema)).toBe(initExpect);
    expect(empty(schema)).toBeNull();
  });

  it("bigint", () => {
    const schema = z.bigint();
    expect(init(schema)).toBe(0);
    expect(empty(schema)).toBeNull();
  });

  it("boolean", () => {
    const schema = z.boolean();
    expect(init(schema)).toBe(false);
    expect(empty(schema)).toBeNull();
  });

  it("date", () => {
    const schema = z.date();
    expect(init(schema)).toEqual(new Date());
    expect(empty(schema)).toBeNull();
  });

  it("literal", () => {
    const schema = z.literal("literal");
    expect(init(schema)).toBe("literal");
    expect(empty(schema)).toBe("literal");
  });

  it("array", () => {
    const schema = z.array(z.string());
    expect(init(schema)).toEqual([]);
    expect(empty(schema)).toEqual([]);
  });

  it("transform", () => {
    const schema = z.string().transform((val) => val.length);
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();
  });

  it("object", () => {
    const schema = z.object({
      foo: z.string(),
      bar: z.number(),
      buz: z.array(z.string()),
    });
    expect(init(schema)).toEqual({
      foo: "",
      bar: 0,
      buz: [],
    });
    expect(empty(schema)).toEqual({
      foo: null,
      bar: null,
      buz: [],
    });
  });

  it("record", () => {
    const schema = z.record(z.string(), z.number());
    expect(init(schema)).toEqual({});
    expect(empty(schema)).toEqual({});
  });

  it("enum", () => {
    const schema = z.enum(["light", "dark"]);
    expect(init(schema)).toBe("light");
    expect(empty(schema)).toBeNull();
  });

  it("nativeEnum", () => {
    enum NativeEnum {
      a = 1,
      b = 2,
    }

    const schema = z.nativeEnum(NativeEnum);
    expect(init(schema)).toBe(NativeEnum.a);
    expect(empty(schema)).toBeNull();
  });

  it("union", () => {
    let schema: z.Schema = z.union([z.string(), z.number()]);
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();

    schema = z.union([z.number(), z.string()]);
    expect(init(schema)).toBe(0);
    expect(empty(schema)).toBeNull();
  });

  it("discriminatedUnion", () => {
    const schema = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), a: z.string(), c: z.number() }),
      z.object({ type: z.literal("b"), b: z.string() }),
    ]);
    expect(init(schema)).toEqual({ type: "a", a: "", c: 0 });
    expect(empty(schema)).toEqual({ type: "a", a: null, c: null });
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

    const schema = z.intersection(Person, Employee);
    expect(init(schema)).toEqual({
      name: "",
      age: 0,
      role: "",
      salary: 0,
    });
    expect(empty(schema)).toEqual({
      name: null,
      age: null,
      role: null,
      salary: null,
    });
  });

  // Could there be a more appropriate test?
  it("function", () => {
    const schema = z
      .function()
      .args(z.number(), z.string())
      .returns(z.boolean());
    expect(init(schema)(0, "")).toBe(false);
    expect(empty(schema)).toBeNull();
  });

  it("lazy", () => {
    const schema = z.lazy(() => z.string());
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();
  });

  it("tuple", () => {
    const schema = z.tuple([z.string(), z.number()]);
    expect(init(schema)).toEqual(["", 0]);
    expect(empty(schema)).toEqual([null, null]);
  });

  it("set", () => {
    const schema = z.set(z.string());
    expect(init(schema)).toEqual(new Set());
    expect(empty(schema)).toEqual(new Set());
  });

  it("map", () => {
    const schema = z.map(z.string(), z.number());
    expect(init(schema)).toEqual(new Map());
    expect(empty(schema)).toEqual(new Map());
  });

  describe("default", () => {
    it.each([
      ["string", "default value", z.string()],
      ["number", 2, z.number()],
      ["boolean", true, z.boolean()],
      ["any", { default: true }, z.any()],
    ])("%s", (_, defaultValue, baseSchema) => {
      expect(init((baseSchema as any).default(defaultValue))).toStrictEqual(
        defaultValue,
      );
    });

    it("function", () => {
      const defaultFunction = (s: string) => s?.length;
      const schema = z
        .function()
        .args(z.string())
        .returns(z.number())
        .default(() => defaultFunction);
      expect(init(schema)).toBe(defaultFunction);
      expect(empty(schema)).toBe(defaultFunction);
    });

    it("clone", () => {
      // return value for object/array/set/map not strict equal to default parameter.
      const defaultObject = { default: true };
      const schema = z.any().default(defaultObject);
      expect(init(schema) === defaultObject).toBe(false);
      expect(empty(schema) === defaultObject).toBe(false);
    });
  });

  it("nan", () => {
    const schema = z.nan();
    expect(init(schema)).toBeNaN();
    expect(empty(schema)).toBeNaN();
  });

  it("null", () => {
    const schema = z.null();
    expect(init(schema)).toBeNull();
    expect(empty(schema)).toBeNull();
  });

  describe("nullable", () => {
    it("string", () => {
      const schema = z.string().nullable();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });
    it("number", () => {
      const schema = z.number().nullable();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });
    it("array", () => {
      const schema = z.array(z.string()).nullable();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toStrictEqual([]);
    });
  });

  describe("nullish", () => {
    it("string", () => {
      const schema = z.string().nullish();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });
    it("number", () => {
      const schema = z.number().nullish();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });
    it("array", () => {
      const schema = z.array(z.string()).nullish();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toStrictEqual([]);
    });
  });

  it("any", () => {
    const schema = z.any();
    expect(init(schema)).toBeNull();
    expect(empty(schema)).toBeNull();
  });

  it("optional", () => {
    const schema = z.string().optional();
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();
  });

  it("undefined", () => {
    const schema = z.undefined();
    expect(init(schema)).toBeUndefined();
    expect(empty(schema)).toBeNull();
  });

  it("void", () => {
    const schema = z.void();
    expect(init(schema)).toBeUndefined();
    expect(empty(schema)).toBeNull();
  });

  it("unknown", () => {
    const schema = z.unknown();
    expect(init(schema)).toBeNull();
    expect(empty(schema)).toBeNull();
  });

  it("never", () => {
    const schema = z.never();
    expect(init(schema)).toBeUndefined();
    expect(empty(schema)).toBeNull();
  });

  it("pipe", () => {
    let schema: any = z.string().pipe(z.number());
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();

    schema = z.number().pipe(z.string());
    expect(init(schema)).toBe(0);
    expect(empty(schema)).toBeNull();

    schema = z.string().pipe(z.number()).pipe(z.boolean());
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();
  });
});
