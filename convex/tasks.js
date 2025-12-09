import { query, mutation } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const send = mutation(async ({ db }, { text, isCompleted }) => {
  return await db.insert("tasks", {
    text,
    isCompleted,
  });
});