// Backend/Controllers/RoleController.js
const Role = require("../Model/RoleModel");

const list = async (_req, res) => {
  try {
    const items = await Role.find().sort({ name: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const create = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().toLowerCase();
    if (!name) return res.status(400).json({ message: "Role name required" });
    const body = {
      name,
      description: req.body.description || "",
      privileges: Array.isArray(req.body.privileges) ? req.body.privileges : [],
    };
    const doc = new Role(body);
    await doc.save();
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const update = async (req, res) => {
  try {
    const update = {
      description: req.body.description || "",
      privileges: Array.isArray(req.body.privileges) ? req.body.privileges : [],
    };
    if (req.body.name) update.name = String(req.body.name).trim().toLowerCase();
    const doc = await Role.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ message: "Role not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const remove = async (req, res) => {
  try {
    const doc = await Role.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Role not found" });
    res.json({ message: "Role deleted" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { list, create, update, remove };
