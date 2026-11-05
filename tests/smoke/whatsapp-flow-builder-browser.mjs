/** Browser-only synthetic component harness. No production session, DB or provider integration. */
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { makeNode } from "../../src/lib/marketing/flows/model.ts";
const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.FLOW_PREVIEW_ORIGIN || "http://127.0.0.1:5533";
assert.equal(origin, "http://127.0.0.1:5533");
const output = process.env.FLOW_PREVIEW_OUTPUT || "/tmp/taxicrm-flow-preview";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [],
  mutations = [],
  cases = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (!["GET", "HEAD"].includes(r.method())) mutations.push(r.url());
});
page.on("dialog", (d) => void d.accept());
try {
  await page.goto(origin);
  await page.getByRole("heading", { name: "Conversation builder" }).waitFor();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Draft saved in this browser" })
    .waitFor();
  await page.getByRole("button", { name: "▷ Simulate", exact: true }).click();
  await page.getByText("QUESTION", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Offers", exact: true }).click();
  await page.getByText("COMPLETE", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Simulated tags: offers_interest").count(),
    0,
  );
  cases.push("consent branch skips marketing without permission");
  await page
    .getByRole("checkbox", { name: "Marketing permission", exact: true })
    .check();
  await page.getByRole("button", { name: "Run from start" }).click();
  await page.getByRole("button", { name: "Offers", exact: true }).click();
  await page
    .getByText("Simulated tags: offers_interest", { exact: true })
    .waitFor();
  cases.push("interactive answer routes to simulated message and tag");
  await page.getByRole("checkbox", { name: "Operator has taken over" }).check();
  await page.getByRole("button", { name: "Run from start" }).click();
  await page
    .getByText("Automatic steps are paused.", { exact: true })
    .waitFor();
  cases.push("operator takeover blocks the simulated run");
  await page
    .getByRole("checkbox", { name: "Operator has taken over" })
    .uncheck();
  await page.getByRole("checkbox", { name: "24-hour window open" }).uncheck();
  await page.getByRole("button", { name: "Run from start" }).click();
  await page
    .getByText(
      "Blocked: the 24-hour window is closed. Use an approved template.",
      { exact: true },
    )
    .waitFor();
  cases.push("closed 24-hour window blocks the question");
  await page
    .getByRole("textbox", { name: "Flow name", exact: true })
    .fill("Synthetic browser flow");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Flow name", exact: true })
      .inputValue(),
    "Synthetic browser flow",
  );
  cases.push("local draft survives reload");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const path = await (await download).path();
  const exported = JSON.parse(await readFile(path, "utf8"));
  assert.equal(exported.format, "taxicrm.flow-draft/v1");
  assert.equal(exported.name, "Synthetic browser flow");
  assert.equal(exported.mode, undefined);
  cases.push("JSON backup contains a draft, no execution mode");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "unsafe.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...exported, execution_enabled: true }),
      ),
    });
  await page
    .getByRole("status")
    .filter({ hasText: "Import rejected" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Flow name", exact: true })
      .inputValue(),
    "Synthetic browser flow",
  );
  cases.push("unsafe import is rejected without replacing the draft");
  const nodes = [
    makeNode("trigger", "start"),
    makeNode("wait", "wait"),
    makeNode("end", "done"),
  ];
  const wait = {
    format: "taxicrm.flow-draft/v1",
    name: "Synthetic wait",
    nodes,
    edges: [
      { id: "a", source: "start", target: "wait", port: "next" },
      { id: "b", source: "wait", target: "done", port: "next" },
    ],
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "wait.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(wait)),
    });
  await page.getByRole("button", { name: "▷ Simulate", exact: true }).click();
  await page.getByText("WAITING", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Advance 60s" }).click();
  await page.getByText("COMPLETE", { exact: true }).waitFor();
  cases.push("virtual wait resumes without scheduling a timer");
  await page.getByRole("button", { name: "New flow", exact: true }).click();
  await page.getByTitle("Add Message", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Block title", exact: true })
    .fill("Browser message");
  await page
    .getByRole("textbox", { name: "Message text", exact: true })
    .fill("Hello {{customer_name}}.");
  await page.getByTitle("Add End", { exact: true }).click();
  const canvas = await page.getByTestId("flow-canvas").boundingBox();
  async function moveBlock(label, x, y) {
    const box = await page
      .locator(".react-flow__node")
      .filter({ has: page.locator("strong", { hasText: label }) })
      .boundingBox();
    await page.mouse.move(box.x + 35, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(canvas.x + x, canvas.y + y, { steps: 12 });
    await page.mouse.up();
  }
  await moveBlock("End", 720, 380);
  await moveBlock("Browser message", 400, 220);
  await page.getByRole("button", { name: "Fit all blocks" }).click();
  await page.waitForTimeout(250);
  async function wire(sourceLabel, targetLabel) {
    const from = page
      .locator(".react-flow__node")
      .filter({ has: page.locator("strong", { hasText: sourceLabel }) })
      .locator(".source");
    const to = page
      .locator(".react-flow__node")
      .filter({ has: page.locator("strong", { hasText: targetLabel }) })
      .locator(".target");
    const a = await from.boundingBox(),
      b = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
    await page.mouse.up();
  }
  await wire("Trigger", "Browser message");
  await wire("Browser message", "End");
  await page
    .getByRole("heading", { name: "✓ All paths connected", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "▷ Simulate", exact: true }).click();
  await page.getByText("COMPLETE", { exact: true }).waitFor();
  cases.push("palette add, inspector edit, drag, connect and run a new graph");
  await page
    .locator(".react-flow__node")
    .filter({ has: page.locator("strong", { hasText: "Browser message" }) })
    .click();
  await page.getByRole("button", { name: "Delete block", exact: true }).click();
  assert.equal(await page.locator(".react-flow__node").count(), 2);
  assert.equal(await page.locator(".react-flow__edge").count(), 0);
  cases.push("deleting a block removes its connections");
  await page.getByRole("button", { name: "Load welcome example" }).click();
  await page.getByRole("button", { name: "Fit all blocks" }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: output + "/draft-dark.png", fullPage: true });
  await page.getByRole("button", { name: "▷ Simulate", exact: true }).click();
  await page
    .getByRole("button", { name: "Speak to the team", exact: true })
    .click();
  await page.getByText("HANDOFF", { exact: true }).waitFor();
  await page.screenshot({ path: output + "/handoff.png", fullPage: true });
  cases.push("operator handoff ends the path");
  await page.goto(origin + "/?theme=light&readonly=1");
  await page.getByRole("heading", { name: "Conversation builder" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Save draft", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: "Flow name", exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({ path: output + "/draft-light.png", fullPage: true });
  cases.push("view-only mode disables editing");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + "/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  cases.push("mobile layout has no horizontal overflow");
  assert.deepEqual(errors, []);
  assert.deepEqual(mutations, []);
  console.log(
    JSON.stringify({
      passed: true,
      cases,
      console_errors: errors.length,
      http_mutations: mutations.length,
      provider_posts: 0,
    }),
  );
} finally {
  await browser.close();
}
