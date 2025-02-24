import {
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  captureEvent,
  defaultStackParser,
  globalHandlersIntegration,
  init,
  makeFetchTransport,
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
  const event = {
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : "Error",
          value: error instanceof Error ? error.message : String(error),
          stacktrace: error instanceof Error && error.stack ? { frames: [] } : undefined,
        },
      ],
    },
    level,
  };

  captureEvent(event);

  if (process.env.NODE_ENV === "development") {
    console.error(error);
  }
}
