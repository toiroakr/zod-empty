import { afterEach, beforeEach, expect, describe, it, vi } from "vitest";
import z from "zod";
import make from "./index";

describe("make empty", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("string", () => {
    expect(make(z.string())).toBe("");
  });

  it("number", () => {
    expect(make(z.number())).toBe(0);
    expect(make(z.number().min(10))).toBe(10);
    expect(make(z.number().max(100))).toBe(100);
    expect(make(z.number().min(10).max(100))).toBe(10);
    expect(make(z.number().max(100).min(10))).toBe(100);
  });

  it("bigint", () => {
    expect(make(z.bigint())).toBe(0);
  });

  it("boolean", () => {
    expect(make(z.boolean())).toBe(false);
  });

  it("date", () => {
    expect(make(z.date())).toEqual(new Date());
  });

  it("literal", () => {
    expect(make(z.literal("literal"))).toBe("literal");
  });

  it("array", () => {
    expect(make(z.array(z.string()))).toEqual([]);
  });

  it("transform", () => {
    expect(make(z.string().transform((val) => val.length))).toBe("");
  });

  it("object", () => {
    expect(make(z.object({ foo: z.string(), bar: z.number() }))).toEqual({
      foo: "",
      bar: 0,
    });
  });

  it("record", () => {
    expect(make(z.record(z.string(), z.number()))).toEqual({});
  });

  it("enum", () => {
    expect(make(z.enum([`light`, `dark`]))).toBe("light");
  });

  it("nativeEnum", () => {
    enum NativeEnum {
      a = 1,
      b = 2,
    }

    expect(make(z.nativeEnum(NativeEnum))).toBe(NativeEnum.a);
  });

  it("union", () => {
    expect(make(z.union([z.string(), z.number()]))).toBe("");
  });

  it("discriminatedUnion", () => {
    expect(
      make(
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

    expect(make(z.intersection(Person, Employee))).toEqual({
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
    expect(make<SchemaType>(schema)(0, "")).toBe(false);
  });

  it("tuple", () => {
    expect(make(z.tuple([z.string(), z.number()]))).toEqual(["", 0]);
  });

  it("set", () => {
    expect(make(z.set(z.string()))).toEqual(new Set());
  });

  it("map", () => {
    expect(make(z.map(z.string(), z.number()))).toEqual(new Map());
  });

  it("default", () => {
    expect(make(z.any().default({ default: true }))).toEqual({ default: true });
  });

  it("nan", () => {
    expect(make(z.nan())).toBeNaN();
  });

  it("null", () => {
    expect(make(z.null())).null;
  });

  it("nullable", () => {
    expect(make(z.string().nullable())).null;
  });

  it("nullish", () => {
    expect(make(z.string().nullish())).null;
  });

  it("optional", () => {
    expect(make(z.string().optional())).undefined;
  });

  it("undefined", () => {
    expect(make(z.undefined())).undefined;
  });

  it("void", () => {
    expect(make(z.void())).undefined;
  });

  it("any", () => {
    expect(make(z.any())).undefined;
  });

  it("unknown", () => {
    expect(make(z.unknown())).undefined;
  });

  it("never", () => {
    expect(make(z.never())).undefined;
  });
});
