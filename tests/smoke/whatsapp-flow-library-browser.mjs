/** Actual components with a synthetic API intercepted in Playwright; no app auth/DB/provider. */
import assert from "node:assert/strict";
import { starterDraft } from "../../src/lib/marketing/flows/model.ts";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const rows = new Map(),
  revisions = new Map(),
  errors = [],
  cases = [];
let conflict = false;
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
await page.route("**/api/dashboard/whatsapp/flows*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  let data,
    status = 200;
  if (request.method() === "POST") {
    const x = request.postDataJSON();
    let r = rows.get(x.id);
    if (conflict) {
      status = 409;
      data = { error: "This flow changed. Reload it before saving." };
      conflict = false;
    } else if (x.action === "create") {
      r = {
        id: crypto.randomUUID(),
        name: x.draft.name,
        version: 1,
        archived: false,
        updated_by: "synthetic-author",
        updated_at: new Date().toISOString(),
      };
      rows.set(r.id, r);
      revisions.set(r.id, [
        {
          ...r,
          draft: x.draft,
          author_id: "synthetic-author",
          created_at: r.updated_at,
        },
      ]);
      data = { flow: r };
    } else {
      assert.equal(x.expectedVersion, r.version);
      r = {
        ...r,
        version: r.version + 1,
        name: x.draft?.name || r.name,
        archived:
          x.action === "archive"
            ? true
            : x.action === "restore"
              ? false
              : r.archived,
      };
      rows.set(r.id, r);
      const versions = revisions.get(r.id);
      versions.push({
        ...r,
        draft: x.draft || versions.at(-1).draft,
        author_id: "synthetic-author",
        created_at: r.updated_at,
      });
      data = { flow: r };
    }
  } else if (url.searchParams.has("id")) {
    const id = url.searchParams.get("id"),
      head = rows.get(id),
      versions = revisions.get(id);
    data = url.searchParams.has("history")
      ? { revisions: [...versions].reverse() }
      : {
          flow: {
            ...versions[
              (Number(url.searchParams.get("version")) || head.version) - 1
            ],
            head_version: head.version,
            head_archived: head.archived,
          },
        };
  } else data = { flows: [...rows.values()] };
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
try {
  await page.goto("http://127.0.0.1:5533/?library");
  await page.evaluate(
    (d) =>
      localStorage.setItem(
        "taxicrm:whatsapp-flow-draft:v1:synthetic-library-review",
        JSON.stringify(d),
      ),
    starterDraft(),
  );
  await page
    .getByRole("button", { name: "Open browser draft", exact: true })
    .click();
  assert.equal(rows.size, 0);
  assert.equal(
    await page.getByRole("textbox", { name: "Flow name" }).inputValue(),
    "Welcome and route",
  );
  cases.push("legacy browser draft opens without automatic server writes");

  await page
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved server version 1" })
    .waitFor();
  cases.push("create server draft");
  await page
    .getByRole("textbox", { name: "Flow name" })
    .fill("Synthetic renamed flow");
  await page
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved server version 2" })
    .waitFor();
  cases.push("rename creates revision");
  await page.reload();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Flow name" }).inputValue(),
    "Synthetic renamed flow",
  );
  cases.push("server list survives reload and opens exact content");
  conflict = true;
  await page.getByRole("textbox", { name: "Flow name" }).fill("Conflict edit");
  await page
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "This flow changed" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Flow name" }).inputValue(),
    "Conflict edit",
  );
  cases.push("conflict preserves unsaved editor");
  await page.getByRole("button", { name: "Versions", exact: true }).click();
  await page
    .getByRole("button", { name: "View and simulate v1", exact: true })
    .click();
  assert.equal(
    await page.getByRole("textbox", { name: "Flow name" }).inputValue(),
    "Welcome and route",
  );
  assert.equal(
    await page.getByRole("textbox", { name: "Flow name" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "▷ Simulate", exact: true }).click();
  await page.getByText("QUESTION", { exact: true }).waitFor();
  cases.push("immutable revision is read-only and simulates its snapshot");
  await page.getByRole("button", { name: "Copy to new flow" }).last().click();
  await page
    .getByRole("textbox", { name: "Flow name" })
    .filter({ visible: true })
    .waitFor();
  assert.equal(rows.size, 2);
  cases.push("historical snapshot duplicates into a new flow");
  await page
    .getByRole("button", { name: "Archive", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Restore", exact: true }).waitFor();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore", exact: true })
    .waitFor({ state: "detached" });
  cases.push("archive and restore");
  await page.goto("http://127.0.0.1:5533/?library&readonly");
  await page
    .getByRole("button", { name: "Open", exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Create flow", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Duplicate", exact: true })
      .first()
      .isDisabled(),
    true,
  );
  cases.push("view-only library disables mutations");
  await page.goto("http://127.0.0.1:5533/?library");
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await page.screenshot({
    path: "/tmp/taxicrm-flow-preview/library.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "/tmp/taxicrm-flow-preview/library-report.json",
    JSON.stringify(
      {
        passed: true,
        cases,
        page_errors: errors,
        scope:
          "synthetic API intercepted in browser; no authenticated backend or provider",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, cases }));
} finally {
  await browser.close();
}
