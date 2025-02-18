import * as Sentry from "@sentry/browser";

export function initSentry() {
  const integrations = Sentry.getDefaultIntegrations({}).filter(
    (integration) =>
      !["BrowserApiErrors", "Breadcrumbs", "GlobalHandlers"].includes(integration.name)
  );

  Sentry.init({
    dsn: "https://9c0289d0cde277911bca9891aec3d518@o4508799628738560.ingest.de.sentry.io/4508799635161168",
    transport: Sentry.makeFetchTransport,
    stackParser: Sentry.defaultStackParser,
    integrations,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV,
  });
}

export function logErrorToSentry(
  error: unknown,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "error"
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.captureException(error);
  });
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  }
}
