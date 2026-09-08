const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { validateBabyEvent } = require("./baby-events");
const occurredAt = "2026-09-08T10:00:00.000Z";

test("accepts all event types without optional amounts", () => {
  for (const type of [
    "breastfeeding",
    "bottle-breast-milk",
    "bottle-formula",
    "vomit",
    "regurgitation",
    "care",
    "bath",
  ]) {
    assert.deepEqual(validateBabyEvent({ type, occurredAt }), { type, occurredAt });
  }
  for (const diaper of ["nothing", "urine", "stool", "abundant-stool", "urine-stool", "urine-abundant-stool"]) {
    assert.equal(validateBabyEvent({ type: "diaper", occurredAt, diaper }).diaper, diaper);
  }
  assert.equal(validateBabyEvent({ type: "other", occurredAt, note: " Bain " }).note, "Bain");
});

test("normalizes timestamps and stores only relevant amounts", () => {
  assert.equal(
    validateBabyEvent({
      type: "breastfeeding",
      occurredAt: "2026-09-08T12:00:00+02:00",
      durationMinutes: 12,
      quantityMl: 50,
    }).occurredAt,
    occurredAt,
  );
  assert.deepEqual(validateBabyEvent({ type: "bottle-formula", occurredAt, quantityMl: 90, durationMinutes: 12 }), {
    type: "bottle-formula",
    occurredAt,
    quantityMl: 90,
  });
});

test("rejects malformed events, dates, amounts and missing required details", () => {
  for (const data of [
    null,
    {},
    { type: "unknown", occurredAt },
    { type: "vomit", occurredAt: "bad" },
    { type: "vomit", occurredAt: "2026-09-08" },
    { type: "diaper", occurredAt },
    { type: "other", occurredAt, note: " " },
    { type: "vomit", occurredAt, note: 4 },
    { type: "vomit", occurredAt, note: "x".repeat(2001) },
  ])
    assert.throws(() => validateBabyEvent(data));
  for (const quantityMl of [0, -1, NaN, Infinity, "90"])
    assert.throws(() => validateBabyEvent({ type: "bottle-formula", occurredAt, quantityMl }));
});

function handlers(db) {
  const sandbox = {
    exports: {},
    process: { env: {} },
    console,
    require: (name) => {
      if (name === "aws-sdk")
        return {
          DynamoDB: {
            DocumentClient: function () {
              return db;
            },
          },
          SNS: function () {},
        };
      if (name === "web-push") return {};
      if (name === "./baby-events") return { validateBabyEvent };
      if (name === "taches-menageres-shared") return { generateId: () => "event-id", DEFAULT_CORS_HEADERS: {} };
      throw new Error(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + "/handler.js", "utf8"), sandbox);
  return sandbox.exports;
}
const headers = { "X-Secret-Key": "21cdf2c38551" };

test("API requires household credentials for reading and writing", async () => {
  const api = handlers({});
  assert.equal((await api.getBabyEvents({ headers: {} })).statusCode, 401);
  assert.equal((await api.createBabyEvent({ headers: {} })).statusCode, 401);
});

test("API persists an event and lists every page in event-time order for another household member", async () => {
  let persisted;
  let scans = 0;
  const api = handlers({
    put: ({ Item, TableName }) => ({
      promise: async () => {
        assert.equal(TableName, "gestion-maison-baby-events");
        persisted = Item;
      },
    }),
    scan: ({ ExclusiveStartKey }) => ({
      promise: async () => {
        scans++;
        if (!ExclusiveStartKey)
          return {
            Items: [{ id: "earlier", occurredAt: "2026-09-07T10:00:00.000Z" }],
            LastEvaluatedKey: { id: "earlier" },
          };
        return { Items: [persisted] };
      },
    }),
  });
  const created = await api.createBabyEvent({
    headers: { ...headers, "X-User-Id": "one" },
    body: JSON.stringify({ type: "breastfeeding", occurredAt, durationMinutes: 8 }),
  });
  assert.equal(created.statusCode, 201);
  assert.equal(persisted.durationMinutes, 8);
  const list = await api.getBabyEvents({ headers: { ...headers, "X-User-Id": "two" } });
  assert.equal(scans, 2);
  assert.deepEqual(
    JSON.parse(list.body).map((item) => item.id),
    ["event-id", "earlier"],
  );
});

test("API distinguishes invalid requests from storage failures", async () => {
  const api = handlers({
    put: () => ({
      promise: async () => {
        throw new Error("unavailable");
      },
    }),
  });
  assert.equal((await api.createBabyEvent({ headers, body: "{" })).statusCode, 400);
  assert.equal(
    (await api.createBabyEvent({ headers, body: JSON.stringify({ type: "vomit", occurredAt }) })).statusCode,
    500,
  );
});

test("accepts feeding with optional duration", () => {
  for (const type of ["breastfeeding"]) {
    assert.deepEqual(validateBabyEvent({ type, occurredAt, durationMinutes: 12 }), {
      type,
      occurredAt,
      durationMinutes: 12,
    });
    for (const durationMinutes of [0, -1, "12", Infinity]) {
      assert.throws(() => validateBabyEvent({ type, occurredAt, durationMinutes }));
    }
  }
});
