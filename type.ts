import z from "zod";
import init from "./src/index";

const schema = z.object({
  name: z.string().min(1, { message: "Required" }).default("default string"),
  age: z.number().min(10).default(100),
});
const empty = init(schema);
