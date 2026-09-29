import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
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
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        phone: { label: 'Phone', type: 'text' },
        isAdmin: { label: 'Admin', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const { email, password, phone, isAdmin } = credentials as {
          email?: string;
          password?: string;
          phone?: string;
          isAdmin?: string;
        };

        // Phone login
        if (phone && !email) {
          const user = await prisma.user.findUnique({
            where: { phone: phone as string },
          });
          if (!user) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
          };
        }

        // Email + password login
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email as string },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        // Admin route check
        if (isAdmin === 'true' && user.role !== 'admin') return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || 'customer';
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
});
