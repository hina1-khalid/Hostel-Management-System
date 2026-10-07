const { z } = require("zod");

// validate(schema) -> 400 { message } when the request body does not match; otherwise body is replaced by the parsed copy
const validate = (schema, where = "body") => (req, res, next) => {
  const result = schema.safeParse(req[where] ?? {});
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
      .join(", ");
    return res.status(400).json({ message });
  }
  req[where] = result.data;
  next();
};

module.exports = { validate, z };
