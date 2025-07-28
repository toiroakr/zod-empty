import { describe, expect, it } from "vitest";
import { z } from "zod";
import { empty, init } from ".";

// Check if we're using Zod v3 or v4
const isZodV3 = "args" in z.function();

describe("make empty", () => {
  describe("primitives", () => {
    it("string", () => {
      const schema = z.string();
      expect(init(schema)).toBe("");
      expect(empty(schema)).toBeNull();
    });

    it("coerce string", () => {
      const schema = z.coerce.string();
      expect(init(schema)).toBe("");
      expect(empty(schema)).toBeNull();
    });

    it("string uuid", () => {
      const schema = z.string().uuid();
      expect(init(schema)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(empty(schema)).toBeNull();
    });

    it.each([
      ["", z.number(), 0],
      ["10 < x", z.number().min(10), 10],
      ["10 <= x", z.number().gte(10), 10],
      ["x < 100", z.number().max(100), 100],
      ["x <= 100", z.number().lte(100), 100],
      ["10 < x < 100", z.number().min(10).max(100), 10],
      ["10 <= x <= 100", z.number().gte(10).lte(100), 10],
      ["100 > x > 100", z.number().max(100).min(10), 100],
      ["100 >= x >= 100", z.number().lte(100).gte(10), 100],
    ])("number %s", (_, schema, initExpect) => {
      expect(init(schema)).toBe(initExpect);
      expect(empty(schema)).toBeNull();
    });

    it("coerce number", () => {
      const schema = z.coerce.number();
      expect(init(schema)).toBe(0);
      expect(empty(schema)).toBeNull();
    });

    it("bigint", () => {
      const schema = z.bigint();
      expect(init(schema)).toBe(BigInt(0));
      expect(empty(schema)).toBeNull();
    });

    it("boolean", () => {
      const schema = z.boolean();
      expect(init(schema)).toBe(false);
      expect(empty(schema)).toBeNull();
    });

    it("date", () => {
      const schema = z.date();
      expect(init(schema)).toBeInstanceOf(Date);
      expect(empty(schema)).toBeNull();
    });

    it("literal", () => {
      const schema = z.literal("literal");
      expect(init(schema)).toBe("literal");
      expect(empty(schema)).toBe("literal");
    });

    it("symbol", () => {
      // return undefined
      const schema = z.symbol();
      expect(init(schema)).toBeUndefined();
      expect(empty(schema)).toBeNull();
    });

    it("null", () => {
      const schema = z.null();
      expect(init(schema)).toBeNull();
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
  });

  it("enum", () => {
    const Fish = z.enum(["Salmon", "Tuna", "Trout"]);
    type Fish = z.infer<typeof Fish>;
    expect(init(Fish)).toBe("Salmon");
    expect(empty(Fish)).toBeNull();
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
    const schema = z.intersection(
      z.object({
        a: z.string(),
      }),
      z.object({
        b: z.number(),
      }),
    );
    expect(init(schema)).toEqual({ a: "", b: 0 });
    expect(empty(schema)).toEqual({ a: null, b: null });
  });

  it("record", () => {
    const schema = z.record(z.string());
    expect(init(schema)).toEqual({});
    expect(empty(schema)).toEqual({});
  });

  it("object", () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
    });
    expect(init(schema)).toEqual({ a: "", b: 0 });
    expect(empty(schema)).toEqual({ a: null, b: null });
  });

  // Could there be a more appropriate test?
  it.skipIf(!isZodV3)("function", () => {
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

  it("array", () => {
    const schema = z.array(z.string());
    expect(init(schema)).toEqual([]);
    expect(empty(schema)).toEqual([]);
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

  it("pipe", () => {
    const schema = z
      .string()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().transform((s) => s.length));
    expect(init(schema)).toBe(0);
    expect(empty(schema)).toBeNull();
  });

  describe("nullable", () => {
    it("nullable string", () => {
      const schema = z.string().nullable();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });

    it("coerce nullable string", () => {
      const schema = z.coerce.string().nullable();
      expect(init(schema)).toBe("");
      expect(empty(schema)).toBeNull();
    });
  });

  describe("nullish", () => {
    it("nullish string", () => {
      const schema = z.string().nullish();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });

    it("coerce nullish string", () => {
      const schema = z.coerce.string().nullish();
      expect(init(schema)).toBe("");
      expect(empty(schema)).toBeNull();
    });
  });

  it("optional", () => {
    const schema = z.string().optional();
    expect(init(schema)).toBe("");
    expect(empty(schema)).toBeNull();
  });

  describe("default", () => {
    it("string", () => {
      const schema = z.string().default("default");
      expect(init(schema)).toBe("default");
      expect(empty(schema)).toBe("default");
    });

    it("number", () => {
      const schema = z.number().default(10);
      expect(init(schema)).toBe(10);
      expect(empty(schema)).toBe(10);
    });

    it("boolean", () => {
      const schema = z.boolean().default(true);
      expect(init(schema)).toBe(true);
      expect(empty(schema)).toBe(true);
    });

    it("any", () => {
      const schema = z.any().default("any default");
      expect(init(schema)).toBe("any default");
      expect(empty(schema)).toBe("any default");
    });

    it.skipIf(!isZodV3)("function", () => {
      const defaultFunction = () => 10;
      const schema = z
        .function()
        .args(z.string())
        .returns(z.number())
        .default(() => defaultFunction);
      expect(init(schema)).toBe(defaultFunction);
      expect(empty(schema)).toBe(defaultFunction);
    });

    it("clone", () => {
      const defaultObject = { a: "string", b: 10 };
      const schema = z.any().default(defaultObject);
      const result = init(schema);
      expect(result).toEqual(defaultObject);
      expect(result).not.toBe(defaultObject);
      const emptyResult = empty(schema);
      expect(emptyResult).toEqual(defaultObject);
      expect(emptyResult).not.toBe(defaultObject);
    });

    it("nullable string", () => {
      const schema = z.string().nullable().default("default");
      expect(init(schema)).toBe("default");
      expect(empty(schema)).toBe("default");
    });
  });

  describe("unknownKeys", () => {
    it("nan", () => {
      const schema = z.nan();
      expect(init(schema)).toBe(Number.NaN);
      expect(empty(schema)).toBe(Number.NaN);
    });

    it("any", () => {
      const schema = z.any();
      expect(init(schema)).toBeNull();
      expect(empty(schema)).toBeNull();
    });

    it("unknown", () => {
      // return undefined
      const schema = z.unknown();
      expect(init(schema)).toBeUndefined();
      expect(empty(schema)).toBeNull();
    });

    it("never", () => {
      // return undefined
      const schema = z.never();
      expect(init(schema)).toBeUndefined();
      expect(empty(schema)).toBeNull();
    });
  });

  describe("zod v4 new types", () => {
    it.skip("file", () => {
      // Skip test - z.instanceof() is implemented as custom type in v4
      // and cannot be reliably detected
      if (typeof File === "undefined") {
        return;
      }
      const schema = z.instanceof(File);
      const result = init(schema);
      expect(result).toBeInstanceOf(File);
      expect((result as File).name).toBe("empty.txt");
      expect((result as File).type).toBe("text/plain");
      expect(empty(schema)).toBeNull();
    });

    it("branded", () => {
      const Cat = z.object({ name: z.string() }).brand<"Cat">();
      const result = init(Cat);
      expect(result).toEqual({ name: "" });
      const emptyResult = empty(Cat);
      expect(emptyResult).toEqual({ name: null });
    });

    it("catch with value", () => {
      const numberWithCatch = z.number().catch(42);
      expect(init(numberWithCatch)).toBe(0);
      expect(empty(numberWithCatch)).toBeNull();
    });

    it("catch with function", () => {
      const numberWithCatch = z.number().catch(() => 100);
      expect(init(numberWithCatch)).toBe(0);
      expect(empty(numberWithCatch)).toBeNull();
    });

    // Test other string validators that are simple extensions
    it("string validators", () => {
      // These all return empty string for init() and null for empty()
      const emailSchema = z.string().email();
      expect(init(emailSchema)).toBe("");
      expect(empty(emailSchema)).toBeNull();

      const urlSchema = z.string().url();
      expect(init(urlSchema)).toBe("");
      expect(empty(urlSchema)).toBeNull();

      const emojiSchema = z.string().emoji();
      expect(init(emojiSchema)).toBe("");
      expect(empty(emojiSchema)).toBeNull();

      const cuidSchema = z.string().cuid();
      expect(init(cuidSchema)).toBe("");
      expect(empty(cuidSchema)).toBeNull();

      const ulidSchema = z.string().ulid();
      expect(init(ulidSchema)).toBe("");
      expect(empty(ulidSchema)).toBeNull();
    });

    // Test IP address validators
    it("IP validators", () => {
      const ipv4Schema = z.string().ipv4();
      const ipv4Result = init(ipv4Schema);
      expect(ipv4Result).toBe("0.0.0.0");
      // Verify it's a valid IPv4
      expect(() => ipv4Schema.parse(ipv4Result)).not.toThrow();
      expect(empty(ipv4Schema)).toBeNull();

      const ipv6Schema = z.string().ipv6();
      const ipv6Result = init(ipv6Schema);
      expect(ipv6Result).toBe("::");
      // Verify it's a valid IPv6
      expect(() => ipv6Schema.parse(ipv6Result)).not.toThrow();
      expect(empty(ipv6Schema)).toBeNull();
    });

    // Test date/time validators
    it("date/time validators", () => {
      const datetimeSchema = z.string().datetime();
      expect(init(datetimeSchema)).toBe("");
      expect(empty(datetimeSchema)).toBeNull();

      const dateSchema = z.string().date();
      expect(init(dateSchema)).toBe("");
      expect(empty(dateSchema)).toBeNull();

      const timeSchema = z.string().time();
      expect(init(timeSchema)).toBe("");
      expect(empty(timeSchema)).toBeNull();
    });

    // Test other string format validators
    it("other string validators", () => {
      const base64Schema = z.string().base64();
      expect(init(base64Schema)).toBe("");
      expect(empty(base64Schema)).toBeNull();

      const base64urlSchema = z.string().base64url();
      expect(init(base64urlSchema)).toBe("");
      expect(empty(base64urlSchema)).toBeNull();

      const jwtSchema = z.string().jwt();
      expect(init(jwtSchema)).toBe("");
      expect(empty(jwtSchema)).toBeNull();
    });

    // Test template literal
    it("template literal", () => {
      const templateSchema = z.templateLiteral`hello-${z.string()}-world`;
      expect(init(templateSchema)).toBe("hello--world");
      expect(empty(templateSchema)).toBeNull();
    });

    // Test prefault (internal/experimental method similar to default)
    it("prefault", () => {
      const prefaultSchema = z.string().prefault("default value");
      expect(init(prefaultSchema)).toBe("default value");
      expect(empty(prefaultSchema)).toBe("default value");
    });

    // Test success type - skip as it's not a schema type but a parse result property
    it.skip("success", () => {
      // success is a property on parse results, not a schema type
      // const result = z.string().safeParse("test");
      // result.success === true or false
    });

    // Test readonly
    it("readonly", () => {
      const readonlySchema = z.object({ name: z.string() }).readonly();
      const result = init(readonlySchema);
      expect(result).toEqual({ name: "" });
      expect(empty(readonlySchema)).toEqual({ name: null });
    });
  });
});
