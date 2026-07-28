const toDateString = (value) => {
  if (!value) return null;
  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const addRecurringFrequency = (dateValue, frequency, repeatEvery = 1) => {
  const normalized = toDateString(dateValue);
  if (!normalized) throw new Error("Invalid recurring invoice date");

  const date = new Date(`${normalized}T00:00:00Z`);
  const repeat = Math.max(1, Number(repeatEvery));
  const addMonths = (monthCount) => {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + monthCount);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
    ).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
  };

  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + repeat);
  else if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7 * repeat);
  else if (frequency === "monthly") addMonths(repeat);
  else if (frequency === "quarterly") addMonths(3 * repeat);
  else if (frequency === "yearly") addMonths(12 * repeat);
  else throw new Error("Unsupported recurring invoice frequency");

  return toDateString(date);
};

module.exports = { addRecurringFrequency, toDateString };
