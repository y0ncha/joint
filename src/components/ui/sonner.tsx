"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      style={{ "--width": "min(22rem, calc(100vw - 2rem))" } as React.CSSProperties}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "!left-1/2 !w-fit !max-w-[calc(100vw-2rem)] ![transform:var(--y)_translateX(-50%)] justify-center gap-2 rounded-2xl border-white/50 bg-card/90 px-4 py-2 font-sans text-card-foreground shadow-[0_24px_80px_rgba(15,44,55,0.25)] backdrop-blur-xl [&_[data-content]]:items-center [&_[data-icon]]:m-0 [&_[data-title]]:text-center",
        },
      }}
      {...props}
    />
  );
}
