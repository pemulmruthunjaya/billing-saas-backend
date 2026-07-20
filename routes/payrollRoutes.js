const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createEmployee,
  createPayrollEntry,
  deleteEmployee,
  deletePayrollEntry,
  getEmployees,
  getPayrollEntries,
  importAttendance,
  updateEmployee,
  updatePayrollEntryStatus,
} = require("../controllers/payrollController");

router.get("/employees", authMiddleware, getEmployees);
router.post("/employees", authMiddleware, createEmployee);
router.put("/employees/:id", authMiddleware, updateEmployee);
router.delete("/employees/:id", authMiddleware, deleteEmployee);

router.get("/entries", authMiddleware, getPayrollEntries);
router.post("/entries", authMiddleware, createPayrollEntry);
router.put("/entries/:id/status", authMiddleware, updatePayrollEntryStatus);
router.delete("/entries/:id", authMiddleware, deletePayrollEntry);
router.post("/attendance/import", authMiddleware, importAttendance);

module.exports = router;
