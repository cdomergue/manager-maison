const types = [
  "breast-left",
  "breast-right",
  "bottle-breast-milk",
  "bottle-formula",
  "diaper",
  "vomit",
  "regurgitation",
  "other",
];
const diapers = ["nothing", "urine", "stool", "abundant-stool", "urine-stool", "urine-abundant-stool"];

function validateBabyEvent(body) {
  if (!body || !types.includes(body.type)) throw new Error("Type invalide");
  if (
    typeof body.occurredAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.occurredAt) ||
    !Number.isFinite(Date.parse(body.occurredAt))
  )
    throw new Error("Date invalide");
  const result = { type: body.type, occurredAt: new Date(body.occurredAt).toISOString() };
  if (body.note !== undefined && typeof body.note !== "string") throw new Error("Note invalide");
  const note = (body.note || "").trim();
  if (note.length > 2000) throw new Error("Note trop longue");
  if (body.type === "other" && !note) throw new Error("Texte requis pour divers");
  if (note) result.note = note;
  if (body.type === "diaper") {
    if (!diapers.includes(body.diaper)) throw new Error("Couche invalide");
    result.diaper = body.diaper;
  }
  const quantity = body.type.startsWith("bottle-")
    ? "quantityMl"
    : body.type.startsWith("breast-")
      ? "durationMinutes"
      : null;
  if (quantity && body[quantity] !== undefined && body[quantity] !== null) {
    if (typeof body[quantity] !== "number" || !Number.isFinite(body[quantity]) || body[quantity] <= 0)
      throw new Error("Quantité ou durée invalide");
    result[quantity] = body[quantity];
  }
  return result;
}

module.exports = { validateBabyEvent };
