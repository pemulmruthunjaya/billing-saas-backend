const express = require("express");
const controller = require("../controllers/recurringInvoiceController");

const router = express.Router();

router.get("/", controller.getAll);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.post("/:id/pause", controller.pause);
router.post("/:id/resume", controller.resume);
router.post("/:id/generate", controller.generate);
router.get("/:id/history", controller.history);

module.exports = router;
