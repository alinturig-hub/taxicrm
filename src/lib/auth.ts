import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Email și parolă",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Parolă",
          type: "password",
        },
      },

      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const passwordIsValid = await compare(
          password,
          user.passwordHash,
        );

        if (!passwordIsValid) {
          return null;
        }

        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            lastLoginAt:
              new Date(),
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword:
            user.mustChangePassword,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (
          user as typeof user & {
            role: string;
          }
        ).role;
        token.mustChangePassword = (
          user as typeof user & {
            mustChangePassword:
              boolean;
          }
        ).mustChangePassword;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & {
          id: string;
          role: string;
          mustChangePassword:
            boolean;
        };

        sessionUser.id = String(token.id);
        sessionUser.role = String(token.role);
        sessionUser.mustChangePassword =
          Boolean(
            token.mustChangePassword,
          );
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
