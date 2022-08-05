# zod-empty

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/zod-empty.svg)](https://badge.fury.io/js/zod-empty)

Generate minimum data from [zod](https://github.com/colinhacks/zod) schema.

Same motivation as [json-schema-empty](https://github.com/romeovs/json-schema-empty)

> All libraries that generate data from a json-schema I could find generate random data that conforms to a json schema. This is nice for testing but is not well-suited for generating default data for forms for example.

## Usage

To install json-schema-empty, run:

```shell
npm install zod-empty
```

### [with react-hook-form](samples/react-hook-form)

Use with react-hook-form like this: (ref. [react-hook-form](https://github.com/react-hook-form/resolvers#zod))

```typescript jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import init from "zod-empty";

const schema = z.object({
  name: z.string().min(1, { message: "Required" }),
  age: z.number().min(10),
});
// create default values with zod-empty
const defaultValues = init(schema);

const App = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    // add default values
    defaultValues,
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((d) => console.log(d))}>
      <input {...register("name")} />
      {errors.name?.message && <p>{errors.name?.message}</p>}
      <input type="number" {...register("age", { valueAsNumber: true })} />
      {errors.age?.message && <p>{errors.age?.message}</p>}
      <input type="submit" />
    </form>
  );
};
```
