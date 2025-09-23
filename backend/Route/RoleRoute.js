const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const RoleController = require("../Controlers/RoleController");

const router = express.Router();

// List roles (any authenticated user can read)
router.get("/", requireAuth, RoleController.list);

// Only admins can create/update/delete roles
router.post("/", requireAuth, requireAdmin, RoleController.create);
router.put("/:id", requireAuth, requireAdmin, RoleController.update);
router.delete("/:id", requireAuth, requireAdmin, RoleController.remove);

module.exports = router;
