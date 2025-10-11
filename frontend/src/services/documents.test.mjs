import assert from "assert";
import { normalizeDocuments } from "./normalizeDocuments.js";

function runTests() {
  assert.deepStrictEqual(normalizeDocuments([{ id: 1 }]), [{ id: 1 }]);
  assert.deepStrictEqual(normalizeDocuments({ entries: [{ id: 2 }] }), [{ id: 2 }]);
  assert.deepStrictEqual(normalizeDocuments({ documents: [{ id: 3 }] }), [{ id: 3 }]);
  assert.deepStrictEqual(normalizeDocuments({ items: [{ id: 4 }] }), [{ id: 4 }]);
  assert.deepStrictEqual(normalizeDocuments({ data: [{ id: 5 }] }), [{ id: 5 }]);
  assert.deepStrictEqual(
    normalizeDocuments({ a: { id: 6 }, b: { id: 7 } }).map((d) => d.id).sort(),
    [6, 7]
  );
  assert.deepStrictEqual(normalizeDocuments(JSON.stringify([{ id: 8 }])), [{ id: 8 }]);
  assert.deepStrictEqual(normalizeDocuments(null), []);
  assert.deepStrictEqual(normalizeDocuments(undefined), []);
  assert.deepStrictEqual(normalizeDocuments("not json"), []);
  console.log("All normalizeDocuments tests passed");
}

runTests();
