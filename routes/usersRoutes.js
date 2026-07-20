const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');

// ✅ IMPORTANT: exact path + filename
const authMiddleware = require('../middleware/authMiddleware.js');
const roleMiddleware = require('../middleware/roleMiddleware.js');

router.get('/', authMiddleware, roleMiddleware(["owner"]), usersController.getUsers);

module.exports = router;
