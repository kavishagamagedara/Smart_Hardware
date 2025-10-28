// Backend setup script to create admin user and role
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./Model/UserModel");
const Role = require("./Model/RoleModel");

async function setupAdmin() {
  try {
    await mongoose.connect("mongodb+srv://admin:QsTd3vVSiVm6Pn6j@cluster0.nirwofp.mongodb.net/");
    console.log("Connected to MongoDB");

    // Create admin role if it doesn't exist
    let adminRole = await Role.findOne({ name: "admin" });
    if (!adminRole) {
      adminRole = new Role({
        name: "admin",
        description: "System administrator with full access",
        privileges: [
          "manage_users", "manage_roles", "manage_products", "manage_inventory",
          "manage_all_orders", "moderate_feedback", "manage_suppliers",
          "refund_view_requests", "refund_manage_requests",
          "view_analytics", "export_data", "system_config"
        ]
      });
      await adminRole.save();
      console.log("Admin role created");
    }

    // Create admin user if it doesn't exist
    let adminUser = await User.findOne({ email: "admin@test.com" });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      adminUser = new User({
        name: "Admin User",
        email: "admin@test.com",
        password: hashedPassword,
        role: "admin"
      });
      await adminUser.save();
      console.log("Admin user created: admin@test.com / admin123");
    } else {
      // Update existing user to admin role
      adminUser.role = "admin";
      await adminUser.save();
      console.log("Updated existing user to admin role");
    }

    // Create a test customer
    let customerUser = await User.findOne({ email: "customer@test.com" });
    if (!customerUser) {
      const hashedPassword = await bcrypt.hash("customer123", 10);
      customerUser = new User({
        name: "Test Customer",
        email: "customer@test.com",
        password: hashedPassword,
        role: "user"
      });
      await customerUser.save();
      console.log("Test customer created: customer@test.com / customer123");
    }

    // Create feedback manager role if missing
    let feedbackRole = await Role.findOne({ name: "feedback manager" });
    if (!feedbackRole) {
      feedbackRole = new Role({
        name: "feedback manager",
        description: "Manages customer feedback and reviews",
        privileges: [
          "moderate_feedback",
          "cc_view_feedback",
          "cc_respond_feedback",
          "cc_manage_returns",
          "refund_view_requests",
          "refund_manage_requests"
        ]
      });
      await feedbackRole.save();
      console.log("Feedback manager role created");
    }

    // Update Customer Care Manager role with required permissions
    let ccmRole = await Role.findOne({ name: "customer care manager" });
    if (ccmRole) {
      const requiredPerms = [
        "moderate_feedback",
        "cc_view_feedback",
        "cc_respond_feedback",
        "cc_manage_returns",
        "refund_view_requests",
        "refund_manage_requests",
        "support:read",
        "support:write",
        "notifications:write"
      ];
      
      // Merge existing with required
      const existingPerms = ccmRole.privileges || [];
      const mergedPerms = Array.from(new Set([...existingPerms, ...requiredPerms]));
      ccmRole.privileges = mergedPerms;
      await ccmRole.save();
      console.log("Customer Care Manager role updated with required permissions");
    } else {
      ccmRole = new Role({
        name: "customer care manager",
        description: "Manages customer support and care operations",
        privileges: [
          "moderate_feedback",
          "cc_view_feedback",
          "cc_respond_feedback",
          "cc_manage_returns",
          "refund_view_requests",
          "refund_manage_requests",
          "support:read",
          "support:write",
          "notifications:write"
        ]
      });
      await ccmRole.save();
      console.log("Customer Care Manager role created");
    }

    // Create a feedback manager user
    let feedbackUser = await User.findOne({ email: "feedback@test.com" });
    if (!feedbackUser) {
      const hashedPassword = await bcrypt.hash("feedback123", 10);
      feedbackUser = new User({
        name: "Feedback Manager",
        email: "feedback@test.com",
        password: hashedPassword,
        role: "feedback manager"
      });
      await feedbackUser.save();
      console.log("Feedback manager created: feedback@test.com / feedback123");
    }

    console.log("Setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
}

setupAdmin();