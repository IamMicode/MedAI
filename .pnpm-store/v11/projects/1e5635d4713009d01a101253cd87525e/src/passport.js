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

        const usernameBase = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'medai-user';
        let username = usernameBase;
        let suffix = 1;

        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${usernameBase}${suffix}`;
          suffix += 1;
        }

        const user = await prisma.user.create({
          data: {
            firstname: firstName,
            lastname: lastName,
            username,
            email,
            googleId: profile.id,
            authProvider: 'google',
            avatarUrl,
            emailVerified: true
          }
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));
}

module.exports = { passport, configurePassport };
