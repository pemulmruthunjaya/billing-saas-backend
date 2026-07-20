const express = require("express");
const router = express.Router();

const {
  register,
  login,
  staffLogin
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);          // OWNER login
router.post("/staff/login", staffLogin); // STAFF login

module.exports = router;