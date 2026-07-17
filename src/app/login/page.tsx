import { LoginCard } from "@/app/login/login-card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error === "access_denied"
    ? "This Google account does not have access to Joint."
    : null;

  return <LoginCard initialError={error} />;
}
