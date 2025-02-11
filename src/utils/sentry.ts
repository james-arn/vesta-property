import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
  withScope,
} from "@sentry/browser";

export const sentryScope = new Scope();

export function initSentry() {
  // Filter out integrations that use the global state
  const integrations = getDefaultIntegrations({}).filter(
    (integration) =>
      !["BrowserApiErrors", "Breadcrumbs", "GlobalHandlers"].includes(integration.name)
  );

  const client = new BrowserClient({
    dsn: "https://9c0289d0cde277911bca9891aec3d518@o4508799628738560.ingest.de.sentry.io/4508799635161168",
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV,
  });

  sentryScope.setClient(client);

  client.init();
}

export function logErrorToSentry(
  error: unknown,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "error"
) {
  withScope((scope) => {
    scope.setLevel(level);
    scope.captureException(error);
  });
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  }
}
