const CONVEX_URL = "https://kindhearted-cod-355.convex.cloud";
// These JSDoc type annotations help VS Code find types.
/** @type {import("convex/browser")["ConvexClient"]} */
const ConvexClient = convex.ConvexClient;
const client = new convex.ConvexClient(CONVEX_URL);

/** @type {import("./convex/_generated/api")["api"]} */
const api = convex.anyApi;


client.onUpdate("steps:get", {}, (steps) => console.log(steps));

client.onUpdate(api.steps.getByTourId, { tour_id: "tour_1" }, (steps) => {
  console.log('stepById', steps);
});

client.onUpdate("tasks:get", {}, (tasks) => {
  const container = document.querySelector(".tasks");
  container.innerHTML = "";
  for (const t of tasks.reverse()) {
    const li = document.createElement("li");
    li.textContent = `${t.text} — ${t.isCompleted ? "Done" : "Pending"}`;
    container.appendChild(li);
  }
});

document.querySelector("#taskForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const form = e.target;
  const task = form.task.value.trim();
  const isCompleted = form.isCompleted.checked;

  if (!task) return;

  console.log("Creating task:", task, isCompleted);

  // Mutation to create task
  client.mutation(api.tasks.send, {
    text: task,
    isCompleted: isCompleted,
  });

  form.reset();
});
