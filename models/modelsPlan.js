const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  features: {
    dashboard: { type: Boolean, default: true },
    sales: { type: Boolean, default: false },
    purchases: { type: Boolean, default: false },
    inventory: { type: Boolean, default: false },
    contacts: { type: Boolean, default: false },
    banking: { type: Boolean, default: false },
    accounting: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    automation: { type: Boolean, default: false },
    integrations: { type: Boolean, default: false },
  },
});

module.exports = mongoose.model("Plan", planSchema);