const mongoose = require("mongoose");

const UserActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "login",
        "logout",
        "account_created",
        "account_updated",
        "account_deleted",
        "role_changed",
        "password_changed",
        "avatar_updated",
        "attendance_marked",
        "custom",
      ],
      default: "custom",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 600,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true }
);

UserActivitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("UserActivity", UserActivitySchema);
