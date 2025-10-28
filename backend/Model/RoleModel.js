const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    // store role names lowercased to make lookups reliable
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    privileges: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Prevent deleting a role if any users are still assigned to it (defense in depth)
roleSchema.pre("deleteOne", { document: true, query: false }, async function(next) {
  try {
    const User = require("./UserModel");
    const name = String(this.name || "").trim();
    const count = await User.countDocuments({ role: { $regex: `^${name}$`, $options: "i" } });
    if (count > 0) {
      const err = new Error(`Cannot delete role '${name}' assigned to ${count} user(s).`);
      err.status = 409;
      return next(err);
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

module.exports = mongoose.model("Role", roleSchema);
