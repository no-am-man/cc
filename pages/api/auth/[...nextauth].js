
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || 'cc-republic-secret',
  debug: process.env.NODE_ENV === 'development',
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Explicitly false for localhost dev
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      console.log('[NextAuth] Session Callback:', { sessionUser: session?.user?.email, tokenSub: token?.sub });
      if (session?.user) {
          session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    }
  },
};

export default NextAuth(authOptions);
