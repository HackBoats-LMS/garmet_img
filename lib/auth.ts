import NextAuth from 'next-auth';

import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly"
        }
      }
    }),
    // CredentialsProvider removed for internal-tool Google-only enforcement
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      // Check if email exists in the database with role 'admin'
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email }
        });

        if (dbUser && dbUser.role === 'admin') {
          return true; // Allow DB-registered admins
        }
      } catch (err) {
        console.error('Error checking admin user in DB:', err);
      }

      console.warn(`Denied access for unauthorized email: ${email}`);
      return false;
    },
    async jwt({ token, user, account }) {
      // account is only passed on the initial sign-in
      if (account) {
        console.log("GOOGLE GRANTED SCOPES:", account.scope);
        token.accessToken = account.access_token;
      }
      if (user) {
        // Internal tool: default all authenticated users to admin
        token.role = 'admin';
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
});
