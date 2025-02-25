import { Toaster } from "@/components/ui/toaster";
import { PropertyDataProvider } from "@/context/propertyDataContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
            <PropertyDataProvider>
                <App />
                <Toaster />
            </PropertyDataProvider>
        </QueryClientProvider>
    </ErrorBoundary>
);