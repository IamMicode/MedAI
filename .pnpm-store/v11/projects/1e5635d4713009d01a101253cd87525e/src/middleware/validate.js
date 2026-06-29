function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Please check the form and try again.',
        errors: result.error.flatten()
      });
    }
    req.body = result.data;
    return next();
  };
}

module.exports = validate;
