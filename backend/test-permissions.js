// Test script to verify permission normalization
const mongoose = require("mongoose");

// Mock the permsForRole function from auth.js
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

// Test cases
const testCases = [
  {
    input: ["Fin_View_Dashboard", "fin_manage_salary", "FIN_VIEW_DASHBOARD"],
    expected: ["fin_view_dashboard", "fin_manage_salary"],
    description: "Mixed case with duplicates"
  },
  {
    input: ["  manage_users  ", "manage_roles", "MANAGE_USERS"],
    expected: ["manage_users", "manage_roles"],
    description: "Whitespace and duplicates"
  },
  {
    input: ["fin_manage_declined_payments", "fin_payroll", "fin_reconcile"],
    expected: ["fin_manage_declined_payments", "fin_payroll", "fin_reconcile"],
    description: "Already normalized"
  },
  {
    input: [],
    expected: [],
    description: "Empty array"
  }
];

console.log("🧪 Testing Permission Normalization\n");

testCases.forEach((test, index) => {
  const result = normalizePrivileges(test.input);
  const passed = JSON.stringify(result.sort()) === JSON.stringify(test.expected.sort());
  
  console.log(`Test ${index + 1}: ${test.description}`);
  console.log(`  Input:    [${test.input.join(", ")}]`);
  console.log(`  Expected: [${test.expected.join(", ")}]`);
  console.log(`  Result:   [${result.join(", ")}]`);
  console.log(`  Status:   ${passed ? "✅ PASSED" : "❌ FAILED"}\n`);
});

// Test frontend permission set logic
console.log("🧪 Testing Frontend Permission Set Logic\n");

const mockUser = {
  permissions: ["Fin_View_Dashboard", "fin_manage_salary", "  manage_users  "]
};

const permissionSet = new Set(
  mockUser.permissions
    .map((p) => String(p || "").trim().toLowerCase())
    .filter(Boolean)
);

console.log("Mock user permissions:", mockUser.permissions);
console.log("Normalized permission set:", Array.from(permissionSet));
console.log("Has 'fin_view_dashboard':", permissionSet.has("fin_view_dashboard"));
console.log("Has 'FIN_MANAGE_SALARY':", permissionSet.has("fin_manage_salary"));
console.log("Has 'manage_users':", permissionSet.has("manage_users"));
console.log("Has 'nonexistent':", permissionSet.has("nonexistent"));

console.log("\n✅ All tests completed!");
