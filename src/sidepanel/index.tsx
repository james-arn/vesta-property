import { Toaster } from "@/components/ui/toaster";
import { createChromeStoragePersister } from '@/lib/chromeStoragePersister';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import React from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "../components/ErrorBoundary";
import Alert from "../components/ui/Alert";
import "../index.css";
import { initSentry } from "../utils/sentry";
import App from "./App";

initSentry();
const container = document.getElementById("root");
const root = createRoot(container!);

const queryClient = new QueryClient()
const chromePersister = createChromeStoragePersister();

persistQueryClient({
    queryClient,
    persister: chromePersister,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Days
    buster: process.env.PACKAGE_VERSION || '',
})

root.render(
    <ErrorBoundary
        fallback={
            <Alert
                type="error"
                message="Sorry! Something went wrong. I'm a solo dev working on this and sometimes Rightmove makes a change that affects the extension. It'll be fixed quickly! Please try refreshing the page."
            />
        }
    >
        <QueryClientProvider client={queryClient}>
            <App />
            <Toaster />
        </QueryClientProvider>
    </ErrorBoundary>
);