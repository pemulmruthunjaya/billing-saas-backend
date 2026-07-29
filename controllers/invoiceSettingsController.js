const {
  getSettings,
  updateSettings,
} = require("../services/invoiceSettingsService");

exports.getInvoiceSettings = async (req, res) => {
  try {
    return res.json(await getSettings(req.user.company_id));
  } catch (error) {
    console.error("Get invoice settings error:", error);
    return res.status(500).json({ message: "Failed to fetch invoice settings" });
  }
};

exports.updateInvoiceSettings = async (req, res) => {
  try {
    const settings = await updateSettings(req.user.company_id, req.body);
    return res.json({ message: "Invoice customization saved", settings });
  } catch (error) {
    console.error("Update invoice settings error:", error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to save invoice settings",
    });
  }
};
