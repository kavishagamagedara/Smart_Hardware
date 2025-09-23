const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },

    age:      { type: Number },
    address:  { type: String },

    // role + granular permissions
    role:        { type: String, default: "user" },         // "user" | "admin" | "staff" | etc.
    permissions: { type: [String], default: [] },           // e.g. ["manage_users","edit_inventory"]

    avatar:   { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
