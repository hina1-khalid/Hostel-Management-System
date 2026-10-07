const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const { wrap, fail, pick, assertId } = require("../utils/helpers");

const FIELDS = ["name", "code", "type", "address", "totalFloors", "warden", "contactNumber", "isActive"];

const createHostel = wrap(async (req, res) => res.status(201).json(await Hostel.create(pick(req.body, FIELDS))));

const getHostels = wrap(async (req, res) => {
  const filter = {};
  if (req.user.role === "admin" && req.user.hostel) filter._id = req.user.hostel;
  res.json(await Hostel.find(filter).populate("warden", "name email").sort({ name: 1 }));
});

const getHostelById = wrap(async (req, res) => {
  assertId(req.params.id);
  const h = await Hostel.findById(req.params.id).populate("warden", "name email");
  if (!h) fail(404, "Hostel not found");
  res.json(h);
});

const updateHostel = wrap(async (req, res) => {
  assertId(req.params.id);
  const h = await Hostel.findById(req.params.id);
  if (!h) fail(404, "Hostel not found");
  Object.assign(h, pick(req.body, FIELDS));
  await h.save();
  res.json(h);
});

const deleteHostel = wrap(async (req, res) => {
  assertId(req.params.id);
  if (await Room.exists({ hostel: req.params.id })) fail(400, "Delete or move this hostel's rooms first");
  const h = await Hostel.findByIdAndDelete(req.params.id);
  if (!h) fail(404, "Hostel not found");
  res.json({ message: "Hostel deleted successfully" });
});

module.exports = { createHostel, getHostels, getHostelById, updateHostel, deleteHostel };
