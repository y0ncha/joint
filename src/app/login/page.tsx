import { LoginCard } from "@/app/login/login-card";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ next?: string }> } = {}) {
  const nextPath = (await searchParams)?.next ?? null;

  return <LoginCard nextPath={nextPath} />;
}
