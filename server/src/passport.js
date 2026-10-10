const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./db');

function configurePassport() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return;
  }

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) {
          return done(null, false, { message: 'Google did not provide an email address.' });
        }

        const existingByGoogle = await prisma.user.findUnique({
          where: { googleId: profile.id }
        });

        if (existingByGoogle) {
          return done(null, existingByGoogle);
        }

        const existingByEmail = await prisma.user.findUnique({
          where: { email }
        });

        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || '';
        const lastName = profile.name?.familyName || '';
        const avatarUrl = profile.photos?.[0]?.value || null;

        if (existingByEmail) {
          const linkedUser = await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              googleId: profile.id,
              authProvider: existingByEmail.authProvider || 'credentials,google',
              avatarUrl,
              emailVerified: true
            }
          });
          return done(null, linkedUser);
        }

        // A brand-new Google identity does NOT get an account here. Google
        // doesn't tell us the user's date of birth, and MedAI is 18+, so the
        // account is only created after the user supplies one and the server
        // validates it (POST /api/auth/google/complete). Until then, nothing
        // exists in the database — an under-18 sign-up leaves no account behind.
        return done(null, false, {
          googleSignup: { googleId: profile.id, email, firstname: firstName, lastname: lastName, avatarUrl }
        });
      } catch (error) {
        return done(error);
      }
    }
  ));
}

module.exports = { passport, configurePassport };
