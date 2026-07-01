const { z } = require('zod');

const optionalString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().optional()
);

const optionalBool = z.preprocess(
  (value) => {
    if(value === undefined || value === null || value === '') return undefined;
    if(typeof value === 'boolean') return value;
    if(value === 'true') return true;
    if(value === 'false') return false;
    return undefined;
  },
  z.boolean().optional()
);

const registerSchema = z.object({
  firstname: optionalString,
  lastname: optionalString,
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(100),
  dob: optionalString,
  gender: optionalString,
  height: optionalString,
  weight: optionalString,
  bloodGroup: optionalString,
  country: optionalString,
  phone: optionalString,
  conditions: z.array(z.string()).optional().default([]),
  otherConditions: optionalString,
  allergies: z.array(z.string()).optional().default([]),
  medications: optionalString,
  smokes: optionalBool,
  alcohol: optionalBool,
  exercises: optionalBool,
  emergName: optionalString,
  emergPhone: optionalString
});

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(1),
  password: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase()
});

const verifyResetCodeSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/)
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(100)
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema
};
