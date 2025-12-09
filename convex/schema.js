import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  steps: defineTable({
    id: v.string(),
    tour_id: v.string(),
    title: v.string(),
    description: v.string(),
    selector: v.string(),
    button_text: v.optional(v.string()),
    bg_color: v.optional(v.string()),
    text_color: v.optional(v.string()),
    highlight_color: v.optional(v.string()),
    started: v.number(),
    completed: v.number(),
    skipped: v.number(),
  }),

  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
});
