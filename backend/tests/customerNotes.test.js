const test = require("node:test");
const assert = require("node:assert/strict");

const { createCustomerNotesHandler } = require("../src/controllers/customerNotes");

const noopLogger = { error: () => {} };

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined,
  };

  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };

  res.json = function json(payload) {
    this.body = payload;
    return this;
  };

  return res;
}

function createHandler(overrides = {}) {
  return createCustomerNotesHandler({
    CustomerModel:
      overrides.CustomerModel ?? {
        findByPk: async () => ({ id: 1 }),
      },
    CustomerNoteModel:
      overrides.CustomerNoteModel ?? {
        findAll: async () => [],
      },
    UserModel: overrides.UserModel ?? {},
    assertCustomerAccess: overrides.assertCustomerAccess ?? (async () => {}),
    logger: overrides.logger ?? noopLogger,
  });
}

test("returns notes for a valid customer", async () => {
  const handler = createHandler({
    CustomerModel: { findByPk: async () => ({ id: 42 }) },
    CustomerNoteModel: { findAll: async () => [{ id: 1, note: "hello" }] },
  });

  const req = {
    params: { id: "42" },
    user: { id: 7, role: "admin" },
    headers: {},
    id: "req-1",
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, [{ id: 1, note: "hello" }]);
});

test("returns an empty array when the customer has no notes", async () => {
  const handler = createHandler({
    CustomerModel: { findByPk: async () => ({ id: 99 }) },
    CustomerNoteModel: { findAll: async () => [] },
  });

  const req = {
    params: { id: "99" },
    user: { id: 1, role: "admin" },
    headers: {},
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test("returns 404 when the customer is missing", async () => {
  const handler = createHandler({
    CustomerModel: { findByPk: async () => null },
  });

  const req = {
    params: { id: "123" },
    user: { id: 1, role: "admin" },
    headers: {},
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { code: "NOT_FOUND", message: "Customer not found" });
});

test("returns 400 for an invalid id", async () => {
  const handler = createHandler();
  const req = {
    params: { id: "abc" },
    user: { id: 1, role: "admin" },
    headers: {},
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { code: "BAD_REQUEST", message: "Invalid customer id" });
});

test("returns 403 when the user lacks access", async () => {
  const handler = createHandler({
    CustomerModel: { findByPk: async () => ({ id: 55 }) },
    assertCustomerAccess: async () => {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    },
  });

  const req = {
    params: { id: "55" },
    user: { id: 12, role: "agent" },
    headers: {},
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    code: "FORBIDDEN",
    message: "You do not have access to this customer",
  });
});

test("returns 500 when fetching notes fails", async () => {
  let logged = false;
  const handler = createHandler({
    CustomerModel: { findByPk: async () => ({ id: 77 }) },
    CustomerNoteModel: {
      findAll: async () => {
        throw new Error("database offline");
      },
    },
    logger: {
      error: () => {
        logged = true;
      },
    },
  });

  const req = {
    params: { id: "77" },
    user: { id: 1, role: "admin" },
    headers: { "x-request-id": "req-err" },
  };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { code: "INTERNAL", message: "Unable to fetch notes" });
  assert.equal(logged, true);
});

test("returns an empty array when the notes table is missing", async () => {
  let warned = false;
  const handler = createHandler({
    CustomerModel: { findByPk: async () => ({ id: 88 }) },
    CustomerNoteModel: {
      findAll: async () => {
        const error = new Error("relation does not exist");
        error.original = { code: "42P01" };
        throw error;
      },
    },
    logger: {
      warn: () => {
        warned = true;
      },
    },
  });

  const req = { params: { id: "88" }, user: { id: 1 }, headers: {} };
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
  assert.equal(warned, true);
});
