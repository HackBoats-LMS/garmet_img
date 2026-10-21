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
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/photoslibrary.appendonly https://www.googleapis.com/auth/photoslibrary"
        }
      },
      allowDangerousEmailAccountLinking: true,
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
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.scope = account.scope;
      }
      if (user) {
        // Internal tool: default all authenticated users to admin
        token.role = 'admin';
        token.id = user.id;
      }

      // Check if access token is expired and refresh if possible
      if (token.expiresAt && Date.now() >= (token.expiresAt as number) * 1000 && token.refreshToken) {
        try {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID || '',
              client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
            }),
          });
          const refreshed = await res.json();
          if (res.ok && refreshed.access_token) {
            token.accessToken = refreshed.access_token;
            token.expiresAt = Math.floor(Date.now() / 1000 + (refreshed.expires_in || 3600));
            if (refreshed.refresh_token) {
              token.refreshToken = refreshed.refresh_token;
            }
          }
        } catch (refreshErr) {
          console.warn('[NextAuth] Error refreshing Google access token:', refreshErr);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).accessToken = token.accessToken;
        (session.user as any).scope = token.scope;
      }
      return session;
    },
  },
});
