// ref. https://github.com/react-hook-form/resolvers#zod
import "./App.css";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { init /* , empty */ } from "zod-empty";

const schema = z.object({
  name: z.string().min(1, { message: "Required" }).default("default string"),
  age: z.number().min(10).default(100),
});
// create default values with zod-empty
const defaultValues = init(schema);
// const defaultValues = empty(schema);

const App = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    // add created default values
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

export default App;
