import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decryptSecret } from "@/lib/security/encryption";
import { encryptedOrionDraft, publicLocalSmsDraft } from "./local-sms-draft";

test("signed Orion configuration is encrypted locally and only redacted settings reach the page", async () => {
  const oldKey = process.env.INTEGRATION_ENCRYPTION_KEY, oldPath = process.env.SMS_GATEWAY_DRAFT_FILE;
  const directory = await mkdtemp(join(tmpdir(), "synthetic-sms-"));
  try {
    process.env.INTEGRATION_ENCRYPTION_KEY = "b".repeat(64);
    const signature = "a".repeat(64), url = `https://orionconnect.co.uk/api/endpoint/webhook?endpoint_id=1&signature=${signature}`;
    const draft = encryptedOrionDraft(url);
    assert.equal(JSON.stringify(draft).includes(signature), false);
    assert.equal(decryptSecret(draft.signedParametersEncrypted), new URL(url).search);
    assert.equal(draft.enabled, false);
    process.env.SMS_GATEWAY_DRAFT_FILE = join(directory, "draft.json");
    await writeFile(process.env.SMS_GATEWAY_DRAFT_FILE, JSON.stringify(draft), {mode: 0o600});
    const publicSettings = await publicLocalSmsDraft();
    assert.equal(publicSettings?.signedParametersSaved, true);
    assert.equal(JSON.stringify(publicSettings).includes(signature), false);
    assert.equal(JSON.stringify(publicSettings).includes("signedParametersEncrypted"), false);
    assert.throws(() => encryptedOrionDraft(url.replace("orionconnect.co.uk", "example.test")));
  } finally {
    if (oldKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = oldKey;
    if (oldPath === undefined) delete process.env.SMS_GATEWAY_DRAFT_FILE; else process.env.SMS_GATEWAY_DRAFT_FILE = oldPath;
    await rm(directory, {recursive: true});
  }
});
