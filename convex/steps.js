// convex/steps.ts
import { v } from "convex/values";
import { query, mutation} from "./_generated/server";

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

export const updateStats = mutation(async ({ db }, { stepId, action }) => {
  // Find the step by your custom "id" field
  const step = await db
    .query("steps")
    .filter(q => q.eq(q.field("id"), stepId))
    .first();

  if (!step) {
    console.log(`[updateStats] Step not found: ${stepId}`);
    return { success: false, message: "Step not found" };
  }

  const update = {};

  if (action === "started") update.started = (step.started || 0) + 1;
  if (action === "completed") update.completed = (step.completed || 0) + 1;
  if (action === "skipped") update.skipped = (step.skipped || 0) + 1;

  await db.patch(step._id, update);

//   console.log(`[updateStats] Updated step ${stepId}:`, update);

  // Return updated stats
  return { success: true, updated: update };
});