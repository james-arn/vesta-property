import {
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  defaultStackParser,
  globalHandlersIntegration,
  init,
  makeFetchTransport,
  withScope,
} from "@sentry/browser";

export function initSentry() {
  const integrations = [
    browserApiErrorsIntegration(),
    breadcrumbsIntegration(),
    globalHandlersIntegration(),
  ];

  init({
    dsn: "https://9c0289d0cde277911bca9891aec3d518@o4508799628738560.ingest.de.sentry.io/4508799635161168",
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
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
  console.error(error);
  withScope((scope) => {
    scope.setLevel(level);
    scope.captureException(error);
  });
}
