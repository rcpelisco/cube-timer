// Checks firestore.rules in the Firestore emulator: everything the app writes must be allowed, and
// anything else (other people's data, extra fields, oversized lists, stray collections) refused.
// Run with `npm run test:rules` (needs Java 21+ for the emulator).
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-cube-timer",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

const me = env.authenticatedContext("me").firestore();
const other = env.authenticatedContext("other").firestore();
const anon = env.unauthenticatedContext().firestore();

const SID = "mwdoizyrzns9ua";
const solve = (i: number) => ({ t: 9000 + i, pen: 0, scr: "R U R' U'", at: 1794502658041 + i });
const solves = (n: number) => Array.from({ length: n }, (_, i) => solve(i));
const user = { layout: 2, inspection: true, algs: { statuses: { "oll-1": "learning" }, choices: {}, cross: "white", updatedAt: 1 }, order: [SID], updatedAt: serverTimestamp() };
const session = { name: "Session 1", createdAt: 1794495902355, chunks: 1, puzzle: "333", cube: "RS3M", goal: 12000, rounds: [{ startAt: 1, format: "ao5", cutoff: null, limit: null, ats: [1, 2] }] };
const chunk = { sid: SID, k: 0, solves: solves(3) };

let failed = 0;
async function check(name: string, run: () => Promise<unknown>) {
  try { await run(); console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${(e as Error).message.split("\n")[0]}`); }
}
const ok = (p: Promise<unknown>) => assertSucceeds(p);
const no = (p: Promise<unknown>) => assertFails(p);

console.log("What the app does is allowed:");
await check("write all three documents in one batch", () => {
  const b = writeBatch(me);
  b.set(doc(me, "users/me/sessions", SID), session);
  b.set(doc(me, "users/me/chunks", `${SID}_0`), chunk);
  b.set(doc(me, "users/me"), user);
  return ok(b.commit());
});
await check("a full chunk of 1000 solves", () => ok(setDoc(doc(me, "users/me/chunks", `${SID}_1`), { sid: SID, k: 1, solves: solves(1000) })));
await check("a minimal session (no optional fields)", () => ok(setDoc(doc(me, "users/me/sessions/abc123"), { name: "Main", createdAt: 0, chunks: 0 })));
await check("a long csTimer session name", () => ok(setDoc(doc(me, "users/me/sessions/abc124"), { name: "x".repeat(150), createdAt: 0, chunks: 0 })));
await check("the old single-document layout", () => ok(setDoc(doc(me, "users/me"), { sessions: [{ id: SID, name: "S", createdAt: 0, solves: solves(2) }], inspection: false, algs: user.algs, updatedAt: serverTimestamp() })));
await check("read own user document", () => ok(getDoc(doc(me, "users/me"))));
await check("list own sessions and chunks", () => ok(Promise.all([getDocs(collection(me, "users/me/sessions")), getDocs(collection(me, "users/me/chunks"))])));
await check("delete own chunk and session", () => ok(Promise.all([deleteDoc(doc(me, "users/me/chunks", `${SID}_1`)), deleteDoc(doc(me, "users/me/sessions/abc124"))])));
await check("delete everything at once (Delete cloud data)", () => {
  const b = writeBatch(me);
  for (const p of ["users/me/sessions/abc123", `users/me/sessions/${SID}`, `users/me/chunks/${SID}_0`, "users/me"]) b.delete(doc(me, p));
  return ok(b.commit());
});
await check("put the account back for the checks below", () => ok(setDoc(doc(me, "users/me"), user)));

console.log("Other people's data is off limits:");
await check("signed out can't read", () => no(getDoc(doc(anon, "users/me"))));
await check("signed out can't write", () => no(setDoc(doc(anon, "users/me/sessions/x"), { name: "x", createdAt: 0, chunks: 0 })));
await check("another user can't read", () => no(getDoc(doc(other, "users/me"))));
await check("another user can't list chunks", () => no(getDocs(collection(other, "users/me/chunks"))));
await check("another user can't write", () => no(setDoc(doc(other, "users/me/chunks", `${SID}_5`), { sid: SID, k: 5, solves: [] })));
await check("another user can't delete", () => no(deleteDoc(doc(other, "users/me"))));

console.log("Dumping data is refused:");
await check("a collection the app doesn't use", () => no(setDoc(doc(me, "users/me/junk/a"), { blob: "x" })));
await check("a top-level collection", () => no(setDoc(doc(me, "dump/a"), { blob: "x" })));
await check("a document nested under a chunk", () => no(setDoc(doc(me, `users/me/chunks/${SID}_0/more/a`), { blob: "x" })));
await check("an extra field on a chunk", () => no(setDoc(doc(me, "users/me/chunks", `${SID}_2`), { sid: SID, k: 2, solves: [], blob: "x" })));
await check("1001 solves in a chunk", () => no(setDoc(doc(me, "users/me/chunks", `${SID}_2`), { sid: SID, k: 2, solves: solves(1001) })));
await check("solves that aren't a list", () => no(setDoc(doc(me, "users/me/chunks", `${SID}_2`), { sid: SID, k: 2, solves: "x".repeat(1000) })));
await check("a chunk id that doesn't match sid and k", () => no(setDoc(doc(me, "users/me/chunks/whatever"), { sid: SID, k: 2, solves: [] })));
await check("chunk number 1000", () => no(setDoc(doc(me, "users/me/chunks", `${SID}_1000`), { sid: SID, k: 1000, solves: [] })));
await check("an extra field on a session", () => no(setDoc(doc(me, "users/me/sessions/abc125"), { name: "a", createdAt: 0, chunks: 0, blob: "x" })));
await check("a 201-character session name", () => no(setDoc(doc(me, "users/me/sessions/abc125"), { name: "x".repeat(201), createdAt: 0, chunks: 0 })));
await check("a session id with odd characters", () => no(setDoc(doc(me, "users/me/sessions/a.b c"), { name: "a", createdAt: 0, chunks: 0 })));
await check("more than 1000 chunks in a session", () => no(setDoc(doc(me, "users/me/sessions/abc125"), { name: "a", createdAt: 0, chunks: 1001 })));
await check("an extra field on the user document", () => no(setDoc(doc(me, "users/me"), { ...user, blob: "x" })));
await check("a made-up updatedAt", () => no(setDoc(doc(me, "users/me"), { ...user, updatedAt: 5 })));
await check("501 sessions in the order list", () => no(setDoc(doc(me, "users/me"), { ...user, order: Array.from({ length: 501 }, (_, i) => `s${i}`) })));
await check("an oversized statuses map", () => no(setDoc(doc(me, "users/me"), { ...user, algs: { ...user.algs, statuses: Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`c${i}`, "learned"])) } })));

await env.cleanup();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
