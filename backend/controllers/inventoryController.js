const Inventory = require("../models/Inventory");
const { wrap, fail, pick, assertId, hostelFilter, assertHostelAccess } = require("../utils/helpers");

const FIELDS = ["hostel", "room", "itemName", "category", "quantity", "condition", "serialNumber", "purchaseDate", "purchasePrice", "notes"];
const populate = (q) => q.populate("hostel", "name code").populate("room", "roomNumber");

const createItem = wrap(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.hostel) fail(400, "Hostel is required");
  assertHostelAccess(req, data.hostel);
  if (!data.room) delete data.room;
  const item = await Inventory.create(data);
  res.status(201).json(await populate(Inventory.findById(item._id)));
});

const getItems = wrap(async (req, res) => {
  const filter = hostelFilter(req);
  ["category", "condition", "room"].forEach((k) => req.query[k] && (filter[k] = req.query[k]));
  if (req.query.q) filter.itemName = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  res.json(await populate(Inventory.find(filter).sort({ createdAt: -1 })));
});

const getSummary = wrap(async (req, res) => {
  const items = await Inventory.find(hostelFilter(req));
  const byCategory = {};
  items.forEach((i) => (byCategory[i.category] = (byCategory[i.category] || 0) + i.quantity));
  res.json({
    totalItems: items.length,
    totalQuantity: items.reduce((a, i) => a + i.quantity, 0),
    needsAttention: items.filter((i) => ["damaged", "under_repair"].includes(i.condition)).length,
    totalValue: items.reduce((a, i) => a + i.quantity * (i.purchasePrice || 0), 0),
    byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
  });
});

const updateItem = wrap(async (req, res) => {
  assertId(req.params.id);
  const item = await Inventory.findById(req.params.id);
  if (!item) fail(404, "Item not found");
  assertHostelAccess(req, item.hostel);
  Object.assign(item, pick(req.body, FIELDS.filter((f) => f !== "hostel")));
  if (!item.room) item.room = undefined;
  await item.save();
  res.json(await populate(Inventory.findById(item._id)));
});

const deleteItem = wrap(async (req, res) => {
  assertId(req.params.id);
  const item = await Inventory.findById(req.params.id);
  if (!item) fail(404, "Item not found");
  assertHostelAccess(req, item.hostel);
  await item.deleteOne();
  res.json({ message: "Item deleted" });
});

module.exports = { createItem, getItems, getSummary, updateItem, deleteItem };
