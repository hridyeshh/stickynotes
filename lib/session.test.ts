import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext, secondsLeft } from "./session.ts";

test("safeNext keeps same-site paths and rejects everything else", () => {
  assert.equal(safeNext("/library"), "/library");
  assert.equal(safeNext("/t/abc?x=1"), "/t/abc?x=1");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeNext(bad), "/library", String(bad));
  }
});

test("secondsLeft reads exp and fails closed", () => {
  const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
  const now = Math.floor(Date.now() / 1000);
  assert.ok(Math.abs(secondsLeft(jwt({ exp: now + 60 })) - 60) < 2);
  assert.ok(secondsLeft(jwt({ exp: now - 5 })) < 0);
  assert.ok(secondsLeft(jwt({ sub: "no-exp" })) < 0);
  assert.ok(secondsLeft("garbage") < 0);
});
