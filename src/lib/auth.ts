import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev",
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    }
  }
};

import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';

export async function getAuthContext() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    return { type: 'user', value: session.user.email };
  }
  
  const cookieStore = cookies();
  const secretCode = cookieStore.get('secret_code')?.value;
  if (secretCode) {
    return { type: 'secret', value: secretCode };
  }
  
  return null;
}
