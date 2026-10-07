// Unit test for the AI report narrative (Claude path is tested with a mocked API; no key or DB needed):
//   node tests/report.test.js
const { parseNarrative, makeNarrative, rulesNarrative } = require("../controllers/reportController");
let pass = 0, failed = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  ✓", n)) : (failed++, console.log("  ✗ FAIL:", n, x)); };

const stats = (over = {}) => ({
  month: "2026-09",
  occupancy: { totalBeds: 14, occupiedBeds: 3, rate: 21.4, students: 3, allocated: 3 },
  fees: { billed: 30000, collected: 8000, outstanding: 22000, collectionRate: 26.7, overdueCount: 2, count: 4 },
  complaints: { total: 5, resolved: 1, open: 4, avgResolutionHours: 96, byCategory: [], highPriority: 2 },
  attendance: { records: 30, presentRate: 80, absent: 6 },
  gate: { entries: 40, lateEntries: 5, topLate: [{ name: "Ali Khan", count: 3 }], visitors: 4 },
  leaves: { total: 2, approved: 1, rejected: 0, pending: 1 },
  mess: { mealsBooked: 90, rating: { average: 3.1, count: 10 }, byMeal: [], billed: 13500, billsPaid: 0, billsTotal: 3 },
  laundry: { bookings: 4, noShows: 1, slots: 24, utilization: 16.7 },
  inventory: { needsAttention: 2, items: 4 },
  ...over,
});

(async () => {
  console.log("REPORT NARRATIVE");
  const rules = rulesNarrative(stats(), stats(), "Iqbal Hostel");
  ok("rules: summary mentions hostel and numbers", /Iqbal Hostel/.test(rules.summary) && /21.4%/.test(rules.summary));
  ok("rules: flags the right concerns", rules.concerns.length >= 6 && rules.concerns.some((c) => /overdue/.test(c)) && rules.concerns.some((c) => /72 hours/.test(c)) && rules.concerns.some((c) => /Ali Khan/.test(c)));
  ok("rules: gives recommendations", rules.recommendations.length >= 4);
  const healthy = rulesNarrative(stats({ occupancy: { totalBeds: 10, occupiedBeds: 9, rate: 90, students: 9, allocated: 9 }, fees: { billed: 10, collected: 10, outstanding: 0, collectionRate: 100, overdueCount: 0, count: 1 }, complaints: { total: 0, resolved: 0, open: 0, avgResolutionHours: null, byCategory: [], highPriority: 0 }, gate: { entries: 5, lateEntries: 0, topLate: [], visitors: 0 }, mess: { mealsBooked: 1, rating: { average: 4.5, count: 3 }, byMeal: [], billed: 0, billsPaid: 0, billsTotal: 0 }, laundry: { bookings: 0, noShows: 0, slots: 0, utilization: 0 }, inventory: { needsAttention: 0, items: 1 }, attendance: { records: 10, presentRate: 98, absent: 0 } }), stats(), "X");
  ok("rules: healthy month has no concerns", healthy.concerns.length === 0 && /No major concerns/.test(healthy.summary));

  console.log("PARSING");
  const good = { summary: "All fine.", highlights: ["a", "b"], concerns: [], recommendations: ["do x"] };
  ok("parses plain JSON", parseNarrative(JSON.stringify(good)).summary === "All fine.");
  ok("parses ```json fenced``` output with chatter", parseNarrative("Here you go:\n```json\n" + JSON.stringify(good) + "\n```\nHope it helps").highlights.length === 2);
  ok("drops non-string / empty list items", parseNarrative(JSON.stringify({ ...good, highlights: ["ok", 5, "", null, "  fine  "] })).highlights.join("|") === "ok|fine");
  let threw = false; try { parseNarrative("not json at all"); } catch { threw = true; }
  ok("garbage throws (so we fall back)", threw);
  threw = false; try { parseNarrative(JSON.stringify({ highlights: [] })); } catch { threw = true; }
  ok("missing summary throws", threw);

  console.log("CLAUDE PATH (mocked API)");
  const realFetch = global.fetch;
  process.env.ANTHROPIC_API_KEY = "sk-test";
  let sent;
  global.fetch = async (url, opts) => { sent = { url, opts, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ content: [{ type: "text", text: "```json\n" + JSON.stringify(good) + "\n```" }] }) }; };
  let r = await makeNarrative(stats(), stats(), "Iqbal Hostel");
  ok("uses Claude output when available", r.source === "claude" && r.narrative.summary === "All fine.");
  ok("calls the Messages API with key + model + data", /api\.anthropic\.com\/v1\/messages/.test(sent.url) && sent.opts.headers["x-api-key"] === "sk-test" && !!sent.body.model && /Iqbal Hostel/.test(sent.body.messages[0].content) && /"collectionRate":26.7/.test(sent.body.messages[0].content));
  global.fetch = async () => ({ ok: false, status: 529, json: async () => ({}) });
  r = await makeNarrative(stats(), stats(), "Iqbal Hostel");
  ok("API error -> falls back to rules", r.source === "rules" && r.narrative.concerns.length > 0);
  global.fetch = async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "Sorry, I cannot do that." }] }) });
  r = await makeNarrative(stats(), stats(), "Iqbal Hostel");
  ok("unparseable reply -> falls back to rules", r.source === "rules");
  global.fetch = async () => { throw new Error("network down"); };
  r = await makeNarrative(stats(), stats(), "Iqbal Hostel");
  ok("network failure -> falls back to rules", r.source === "rules");
  delete process.env.ANTHROPIC_API_KEY;
  global.fetch = async () => { throw new Error("must not be called without a key"); };
  r = await makeNarrative(stats(), stats(), "Iqbal Hostel");
  ok("no API key -> rules, no network call", r.source === "rules");
  global.fetch = realFetch;

  console.log(`\nRESULT: ${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
