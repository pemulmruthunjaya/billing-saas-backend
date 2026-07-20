const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
  },
  customFeatures: {
    dashboard: { type: Boolean },
    sales: { type: Boolean },
    purchases: { type: Boolean },
    inventory: { type: Boolean },
    contacts: { type: Boolean },
    banking: { type: Boolean },
    accounting: { type: Boolean },
    reports: { type: Boolean },
    automation: { type: Boolean },
    integrations: { type: Boolean },
  },
});

module.exports = mongoose.model("Organization", organizationSchema);