const test = require("node:test");
const assert = require("node:assert/strict");

const { summarizeError, isDropboxNotFound } = require("../src/services/customerDeletionHelpers");

test("summarizeError handles different error shapes", () => {
  assert.equal(summarizeError("plain error"), "plain error");
  assert.equal(summarizeError({ message: "boom" }), "boom");
  assert.equal(
    summarizeError({ error: { error_summary: "detailed message" } }),
    "detailed message"
  );
  assert.equal(typeof summarizeError(null), "string");
});

test("isDropboxNotFound returns true for 409 not found errors", () => {
  assert.equal(
    isDropboxNotFound({ status: 409, error: { error_summary: "path/not_found/.." } }),
    true
  );
  assert.equal(
    isDropboxNotFound({ statusCode: 409, error: { error_summary: "path_lookup/not_found" } }),
    true
  );
  assert.equal(isDropboxNotFound({ status: 500 }), false);
  assert.equal(isDropboxNotFound(null), false);
});
