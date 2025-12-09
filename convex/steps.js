// convex/steps.ts
import { v } from "convex/values";
import { query} from "./_generated/server";

// Query: Get all steps
export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("steps").collect();
  },
});

// Query: Get steps by tour ID
export const getByTourId = query({
  args: { tour_id: v.string() },
  handler: async (ctx, { tour_id }) => {
    return await ctx.db
      .query("steps")
      .filter(q => q.eq(q.field("tour_id"), tour_id))
      .collect();
  },
});
