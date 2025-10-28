// Backend/Controllers/RoleController.js
const Role = require("../Model/RoleModel");

// Utility: normalize and dedupe privileges array
function normalizePrivileges(list) {
  const arr = Array.isArray(list) ? list : [];
  return Array.from(
    new Set(
      arr
        .map((p) => String(p || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

// List all roles, ensuring 'customer care manager' role exists
const list = async (_req, res) => {
  try {
    // Ensure 'customer care manager' role exists
    const CCM_ROLE = {
      name: 'customer care manager',
      description: 'Handles customer feedback, responses, and returns',
      privileges: [
        'cc_view_feedback',
        'cc_respond_feedback',
        'cc_manage_returns',
        'refund_view_requests',
        'refund_manage_requests',
      ],
    };
    let ccm = await Role.findOne({ name: CCM_ROLE.name });
    if (!ccm) {
      ccm = await Role.create(CCM_ROLE);
    }
    const items = await Role.find().sort({ name: 1 });
    // Opportunistically normalize stored privileges on read (non-destructive)
    const normalized = await Promise.all(
      items.map(async (doc) => {
        const fixed = normalizePrivileges(doc.privileges);
        if (fixed.length !== (doc.privileges || []).length ||
            String(doc.name) !== String(doc.name).toLowerCase()) {
          try {
            doc.name = String(doc.name).toLowerCase();
            doc.privileges = fixed;
            await doc.save();
          } catch (e) {
            // log and continue; listing should not fail due to normalization
            console.warn("Role normalization failed for", doc._id, e.message);
          }
        }
        return doc;
      })
    );
    res.json(normalized);
  } catch (e) {
    const status = Number(e.status) || 500;
    res.status(status).json({ message: e.message });
  }
};

// Create a new role
const create = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().toLowerCase();
    if (!name) return res.status(400).json({ message: "Role name required" });
    const body = {
      name,
      description: req.body.description || "",
      privileges: normalizePrivileges(req.body.privileges),
    };
    const doc = new Role(body);
    await doc.save();
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Update an existing role by ID
const update = async (req, res) => {
  try {
    const update = {
      description: req.body.description || "",
      privileges: normalizePrivileges(req.body.privileges),
    };
    if (req.body.name) update.name = String(req.body.name).trim().toLowerCase();
    const doc = await Role.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ message: "Role not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Delete a role by ID
const remove = async (req, res) => {
  try {
    // Find the role first so we know its name
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Check if any users are currently assigned to this role
    const User = require("../Model/UserModel");
    const roleName = String(role.name || "").trim();
    // Case-insensitive match to be safe if user.role stored with different casing
    const assignedCount = await User.countDocuments({ role: { $regex: `^${roleName}$`, $options: "i" } });
    if (assignedCount > 0) {
      return res.status(409).json({
        message: `Cannot delete role '${roleName}' because it is assigned to ${assignedCount} user(s). Remove or reassign these users first.`,
        assignedCount,
      });
    }

    await role.deleteOne();
    res.json({ message: "Role deleted" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { list, create, update, remove };
