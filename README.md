# zod-empty

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/zod-empty.svg)](https://badge.fury.io/js/zod-empty)

Generate minimum data from [zod](https://github.com/colinhacks/zod) schema.

Same motivation as [json-schema-empty](https://github.com/romeovs/json-schema-empty)

> All libraries that generate data from a json-schema I could find generate random data that conforms to a json schema. This is nice for testing but is not well-suited for generating default data for forms for example.

If you’re using Zod 3, please switch to [zod-empty@1](https://github.com/toiroakr/zod-empty/tree/v1).

## Usage

To install zod-empty, run:

```shell
npm install zod-empty
```

### [with react-hook-form](samples/react-hook-form)

Use with react-hook-form like this: (ref. [react-hook-form](https://github.com/react-hook-form/resolvers#zod))

// Please check default value for schema [here](./src/index.spec.ts).

```typescript jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { init /* , empty */ } from "zod-empty";

const schema = z.object({
  name: z.string().min(1, { message: "Required" }),
  age: z.number().min(10),
  hobbies: z.array(z.string()),
});
// create default values with zod-empty
const defaultValues = init(schema); // => { name: "", age: 10, hobbies: [] }
// or const defaultValues = empty(schema); // => { name: null, age: null, hobbies: [] }

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

## Development

Use Node.js 22.13 or newer and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm build:sample
pnpm check
pnpm test
```

`pnpm check` checks formatting with [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) and linting with [oxlint](https://oxc.rs/docs/guide/usage/linter.html).
Use `pnpm format` to format files and `pnpm lint:fix` to apply safe lint fixes.
The React Hook Form sample is included in the pnpm workspace and uses the local library build.
