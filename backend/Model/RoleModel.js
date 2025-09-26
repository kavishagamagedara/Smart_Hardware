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

module.exports = mongoose.model("Role", roleSchema);
