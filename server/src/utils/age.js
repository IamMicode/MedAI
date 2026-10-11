// Minimum-age enforcement (Terms: MedAI is for users 18 or older).
// Server-side source of truth — the signup form's check is only a convenience.

const MIN_AGE = 18;
const MAX_AGE = 120; // rejects typo dates like 1800-01-01

// Strict YYYY-MM-DD (what <input type="date"> produces) and a real calendar
// date — so "2010-02-31" or "not a date" can't slip through as "unparseable,
// therefore allowed".
function parseDob(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return { y, mo, d };
}

function ageOn(dob, now = new Date()) {
  let age = now.getUTCFullYear() - dob.y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < dob.mo ||
    (now.getUTCMonth() + 1 === dob.mo && now.getUTCDate() < dob.d);
  if (beforeBirthday) age -= 1;
  return age;
}

// Returns null if OK, otherwise a user-facing error message.
function checkDob(value, now = new Date()) {
  const dob = parseDob(value);
  if (!dob) return 'Please enter a valid date of birth.';
  const age = ageOn(dob, now);
  if (age < 0 || age > MAX_AGE) return 'Please enter a valid date of birth.';
  if (age < MIN_AGE) return `You must be at least ${MIN_AGE} years old to use MedAI.`;
  return null;
}

module.exports = { MIN_AGE, parseDob, ageOn, checkDob };
