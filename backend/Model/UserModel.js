const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },

    age:      { type: Number },
    address:  { type: String },

    role:        { type: String, default: "user" },        
    permissions: { type: [String], default: [] },         

  avatar:   { type: String, default: "" },

  lastLoginAt: { type: Date },
  loginCount:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
