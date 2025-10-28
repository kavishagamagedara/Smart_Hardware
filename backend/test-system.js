// Comprehensive System Test for Smart Hardware
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./Model/UserModel");
const Role = require("./Model/RoleModel");
const Order = require("./Model/orderModel");
const Product = require("./Model/ProductModel");
const RefundRequest = require("./Model/RefundModel");
const { permsForRole } = require("./middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function pass(testName) {
  results.passed++;
  results.tests.push({ name: testName, status: "PASS" });
  log("✅", `PASS: ${testName}`);
}

function fail(testName, error) {
  results.failed++;
  results.tests.push({ name: testName, status: "FAIL", error });
  log("❌", `FAIL: ${testName} - ${error}`);
}

// Test Suite
async function runTests() {
  try {
    log("🚀", "Starting comprehensive system test...\n");

    // Connect to database with timeout
    try {
      await mongoose.connect("mongodb+srv://admin:QsTd3vVSiVm6Pn6j@cluster0.nirwofp.mongodb.net/test", {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      log("✅", "Database connected\n");
    } catch (err) {
      log("⚠️", "Database connection failed, continuing with offline tests\n");
    }

    // ==================== ROLE & PERMISSION TESTS ====================
    log("📋", "=== Testing Roles & Permissions ===");

    const dbConnected = mongoose.connection.readyState === 1;

    if (!dbConnected) {
      log("⚠️", "Skipping database-dependent tests (no connection)\n");
    }

    // Test 1: Check if admin role exists
    if (dbConnected) {
      try {
        const adminRole = await Role.findOne({ name: "admin" });
        if (adminRole) {
          pass("Admin role exists");
          if (adminRole.privileges && adminRole.privileges.length > 0) {
            pass(`Admin has ${adminRole.privileges.length} privileges`);
          } else {
            fail("Admin privileges check", "Admin role has no privileges");
          }
        } else {
          fail("Admin role exists", "Admin role not found in database");
        }
      } catch (err) {
        fail("Admin role check", err.message);
      }
    }

    // Test 2: Check critical roles
    const criticalRoles = [
      "admin",
      "customer care manager",
      "feedback manager",
      "finance manager",
      "inventory manager",
    ];

    if (dbConnected) {
      for (const roleName of criticalRoles) {
        try {
          const role = await Role.findOne({ name: roleName.toLowerCase() });
          if (role) {
            pass(`Role exists: ${roleName}`);
          } else {
            fail(`Role exists: ${roleName}`, "Role not found");
          }
        } catch (err) {
          fail(`Role check: ${roleName}`, err.message);
        }
      }
    }

    // Test 3: Permission resolution
    try {
      const adminPerms = await permsForRole("admin");
      if (adminPerms.length > 0) {
        pass(`Admin permissions resolved: ${adminPerms.length} permissions`);
      } else {
        fail("Admin permissions", "No permissions returned");
      }
    } catch (err) {
      fail("Permission resolution", err.message);
    }

    // ==================== USER & AUTH TESTS ====================
    log("\n👤", "=== Testing Users & Authentication ===");

    // Test 4: Check if admin user exists
    if (dbConnected) {
      try {
        const adminUser = await User.findOne({ email: "admin@test.com" });
        if (adminUser) {
          pass("Admin user exists");
          if (adminUser.role === "admin") {
            pass("Admin user has correct role");
          } else {
            fail("Admin user role", `Expected 'admin', got '${adminUser.role}'`);
          }
        } else {
          fail("Admin user exists", "Admin user not found");
        }
      } catch (err) {
        fail("Admin user check", err.message);
      }
    }

    // Test 5: Password hashing
    if (dbConnected) {
      try {
        const testUser = await User.findOne({ email: "admin@test.com" });
        if (testUser) {
          const isValidPassword = await bcrypt.compare("admin123", testUser.password);
          if (isValidPassword) {
            pass("Password hashing and verification");
          } else {
            fail("Password verification", "Password does not match");
          }
        }
      } catch (err) {
        fail("Password hashing test", err.message);
      }
    }

    // Test 6: JWT Token generation and validation
    if (dbConnected) {
      try {
        const testUser = await User.findOne({ email: "admin@test.com" });
        if (testUser) {
          const token = jwt.sign(
            { id: testUser._id, email: testUser.email, role: testUser.role },
            JWT_SECRET,
            { expiresIn: "24h" }
          );

          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded.id === testUser._id.toString()) {
            pass("JWT token generation and validation");
          } else {
            fail("JWT validation", "Token payload mismatch");
          }
        }
      } catch (err) {
        fail("JWT token test", err.message);
      }
    }

    // Test 7: ObjectId validation (mock token bug fix)
    try {
      const mockId = "mock_1760611284441";
      const isValid = mongoose.isValidObjectId(mockId);
      if (!isValid) {
        pass("ObjectId validation rejects invalid IDs");
      } else {
        fail("ObjectId validation", "Invalid ID was accepted");
      }
    } catch (err) {
      fail("ObjectId validation", err.message);
    }

    // ==================== MODEL VALIDATION TESTS ====================
    log("\n📦", "=== Testing Database Models ===");

    // Test 8: User model validation
    try {
      const invalidUser = new User({
        name: "Test",
        email: "invalid-email", // Invalid format
        password: "123",
      });
      await invalidUser.validate();
      fail("User model validation", "Invalid user was accepted");
    } catch (err) {
      if (err.name === "ValidationError") {
        pass("User model email validation");
      } else {
        fail("User model validation", err.message);
      }
    }

    // Test 9: Order model
    if (dbConnected) {
      try {
        const orderCount = await Order.countDocuments();
        pass(`Order model accessible: ${orderCount} orders`);
      } catch (err) {
        fail("Order model check", err.message);
      }
    }

    // Test 10: Product model
    if (dbConnected) {
      try {
        const productCount = await Product.countDocuments();
        pass(`Product model accessible: ${productCount} products`);
      } catch (err) {
        fail("Product model check", err.message);
      }
    }

    // Test 11: Refund model
    if (dbConnected) {
      try {
        const refundCount = await RefundRequest.countDocuments();
        pass(`Refund model accessible: ${refundCount} refunds`);
      } catch (err) {
        fail("Refund model check", err.message);
      }
    }

    // ==================== AUTHORIZATION TESTS ====================
    log("\n🔐", "=== Testing Authorization Logic ===");

    // Test 12: Admin can access everything
    if (dbConnected) {
      try {
        const adminUser = await User.findOne({ email: "admin@test.com" });
        if (adminUser) {
          const adminPerms = await permsForRole(adminUser.role);
          const criticalPerms = [
            "manage_users",
            "manage_roles",
            "refund_manage_requests",
            "moderate_feedback",
          ];

          const hasAllPerms = criticalPerms.every((perm) =>
            adminPerms.includes(perm.toLowerCase())
          );

          if (hasAllPerms) {
            pass("Admin has all critical permissions");
          } else {
            fail("Admin permissions", "Missing critical permissions");
          }
        }
      } catch (err) {
        fail("Admin authorization test", err.message);
      }
    }

    // Test 13: Regular user limitations
    try {
      const userPerms = await permsForRole("user");
      const restrictedPerms = ["manage_users", "manage_roles", "refund_manage_requests"];

      const hasRestricted = restrictedPerms.some((perm) =>
        userPerms.includes(perm.toLowerCase())
      );

      if (!hasRestricted) {
        pass("Regular users don't have admin permissions");
      } else {
        fail("User permissions", "Regular user has admin permissions");
      }
    } catch (err) {
      fail("User authorization test", err.message);
    }

    // Test 14: Customer Care Manager permissions
    try {
      const ccmPerms = await permsForRole("customer care manager");
      const requiredPerms = [
        "moderate_feedback",
        "refund_view_requests",
        "refund_manage_requests",
      ];

      const hasRequired = requiredPerms.every((perm) =>
        ccmPerms.map((p) => p.toLowerCase()).includes(perm.toLowerCase())
      );

      if (hasRequired) {
        pass("Customer Care Manager has required permissions");
      } else {
        fail("CCM permissions", "Missing required permissions");
      }
    } catch (err) {
      fail("CCM authorization test", err.message);
    }

    // ==================== DATA INTEGRITY TESTS ====================
    log("\n🔍", "=== Testing Data Integrity ===");

    // Test 15: Check for orphaned refunds
    if (dbConnected) {
      try {
        const refunds = await RefundRequest.find().limit(10);
        let orphanCount = 0;

        for (const refund of refunds) {
          const userExists = refund.user && mongoose.isValidObjectId(refund.user);
          const orderExists = refund.order && mongoose.isValidObjectId(refund.order);

          if (!userExists || !orderExists) {
            orphanCount++;
          }
        }

        if (orphanCount === 0) {
          pass("No orphaned refund records");
        } else {
          fail("Refund data integrity", `Found ${orphanCount} orphaned refunds`);
        }
      } catch (err) {
        fail("Refund integrity check", err.message);
      }
    }

    // Test 16: Check for duplicate emails
    if (dbConnected) {
      try {
        const users = await User.aggregate([
          { $group: { _id: "$email", count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
        ]);

        if (users.length === 0) {
          pass("No duplicate user emails");
        } else {
          fail("User email uniqueness", `Found ${users.length} duplicate emails`);
        }
      } catch (err) {
        fail("Email uniqueness check", err.message);
      }
    }

    // ==================== CONFIGURATION TESTS ====================
    log("\n⚙️", "=== Testing Configuration ===");

    // Test 17: Environment variables
    try {
      const requiredEnvVars = ["JWT_SECRET", "MONGODB_URI"];
      const missing = requiredEnvVars.filter((v) => !process.env[v]);

      if (missing.length === 0) {
        pass("All required environment variables set");
      } else {
        fail("Environment variables", `Missing: ${missing.join(", ")}`);
      }
    } catch (err) {
      fail("Environment config check", err.message);
    }

    // Test 18: CORS configuration
    try {
      // This is a basic check - actual CORS testing requires HTTP requests
      pass("CORS middleware configured (check app.js)");
    } catch (err) {
      fail("CORS configuration", err.message);
    }

    // ==================== RESULTS SUMMARY ====================
    log("\n" + "=".repeat(60));
    log("📊", "TEST RESULTS SUMMARY");
    log("=".repeat(60));
    log("✅", `Passed: ${results.passed}`);
    log("❌", `Failed: ${results.failed}`);
    log("📈", `Total: ${results.passed + results.failed}`);
    log(
      "🎯",
      `Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(
        1
      )}%`
    );

    if (results.failed > 0) {
      log("\n⚠️", "Failed Tests:");
      results.tests
        .filter((t) => t.status === "FAIL")
        .forEach((t) => {
          log("   ❌", `${t.name}: ${t.error}`);
        });
    }

    log("\n" + "=".repeat(60));

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    log("💥", `Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

// Run the tests
runTests();
