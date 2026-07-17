"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function LoginCard({ initialError = null }: { initialError?: string | null }) {
  const [error, setError] = useState<string | null>(initialError);

  async function signInWithGoogle() {
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: new URL("/auth/callback", window.location.origin).toString(),
        },
      });

      if (signInError) {
        setError(signInError.message);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start Google sign in.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md border-white/50 bg-card/90 shadow-[0_24px_70px_rgba(15,44,55,0.2)] backdrop-blur-xl hover:translate-y-0 hover:shadow-[0_24px_70px_rgba(15,44,55,0.2)]">
        <CardHeader className="items-start px-7 pt-10 sm:px-9 sm:pt-12">
          <div className="flex justify-center">
            <BrandMark size={72} />
          </div>
          <p className="mt-12 text-sm font-medium text-primary">Welcome to Joint</p>
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">Money, together.</CardTitle>
          <CardDescription className="mt-3 leading-6">Sign in to your shared household and see the same clear picture of your money.</CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-10 sm:px-9 sm:pb-12">
          <Button className="mt-8 h-12 w-full rounded-xl text-base" onClick={signInWithGoogle}>
            Continue with Google <ArrowRight data-icon="inline-end" />
          </Button>
          {error ? <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-5 text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-3.5 shrink-0" /> Joint never stores your bank credentials or card numbers.</p>
        </CardContent>
      </Card>
    </main>
  );
}
