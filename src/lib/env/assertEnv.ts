import { z } from "zod";

// A utility function to validate environment variables using a Zod schema
export function assertEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  values: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(values);

  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error("Invalid environment variables", {
      cause: result.error,
    });
  }
  return result.data;
}