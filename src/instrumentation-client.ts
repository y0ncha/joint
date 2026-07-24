import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://a7f1063179cb9a502fb1421bfef869d5@o4511761236361216.ingest.de.sentry.io/4511761241800784",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
