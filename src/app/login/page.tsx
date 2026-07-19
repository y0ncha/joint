import { LoginCard } from "@/app/login/login-card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = {
    access_denied: "This Google account does not have access to Joint.",
    missing_code: "We couldn't sign you in with Google. Please try again.",
    oauth_callback: "We couldn't sign you in with Google. Please try again.",
  }[(await searchParams).error ?? ""] ?? null;

  return <LoginCard initialError={error} />;
}
