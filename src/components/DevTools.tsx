import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHECKLIST_NO_VALUE } from "@/constants/checkListConsts";
import { StorageKeys } from "@/constants/storage";
import useSecureAuthentication from "@/hooks/useSecureAuthentication";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface TokenInfo {
    email: string | null;
    exp: number;
    timeRemaining: string;
    isExpired: boolean;
}

const DevTools = () => {
    const { refreshTokenIfNeeded, signOut } = useSecureAuthentication();
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastAction, setLastAction] = useState<string>("");
    const isCheckingDevToolsStateRef = useRef(false);

    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === "development";

    // Don't render anything in production
    if (!isDevelopment) {
        return null;
    }

    const formatTimeRemaining = (seconds: number): string => {
        if (seconds <= 0) return "Expired";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);

        return [
            hours > 0 ? `${hours}h` : "",
            minutes > 0 ? `${minutes}m` : "",
            `${remainingSeconds}s`,
        ]
            .filter(Boolean)
            .join(" ");
    };

    const checkAuthState = useCallback(async () => {
        if (isCheckingDevToolsStateRef.current) {
            console.log("[DevTools] checkAuthState already in progress, skipping.");
            return;
        }
        isCheckingDevToolsStateRef.current = true;
        setIsLoading(true);

        try {
            const tokens = await new Promise<Record<string, any>>((resolve) => {
                chrome.storage.local.get(null, (result) => resolve(result));
            });

            if (tokens[StorageKeys.AUTH_ID_TOKEN]) {
                const payload = JSON.parse(
                    atob(tokens[StorageKeys.AUTH_ID_TOKEN].split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
                );

                const now = Math.floor(Date.now() / 1000);
                const timeLeftSeconds = Math.max(0, payload.exp - now);
                const timeRemaining = formatTimeRemaining(timeLeftSeconds);

                setTokenInfo({
                    email: payload.email || null,
                    exp: payload.exp,
                    timeRemaining,
                    isExpired: timeLeftSeconds <= 0,
                });

                console.log(`Token expires in ${timeRemaining}`);
                console.log(`Email: ${payload.email}`);
            } else {
                setTokenInfo(null);
                console.log("No token found");
            }
        } catch (error) {
            console.error("Error checking auth state in DevTools:", error);
            setTokenInfo(null);
        } finally {
            setIsLoading(false);
            isCheckingDevToolsStateRef.current = false;
        }
    }, []);

    const forceTokenRefresh = async () => {
        setIsLoading(true);
        setLastAction("Forcing token refresh");

        try {
            const success = await refreshTokenIfNeeded();
            console.log("Token refresh attempt result:", success);

            if (success) {
                console.log("Token refreshed successfully");
                // Wait a bit for the token to be stored
                await new Promise(resolve => setTimeout(resolve, 500));
                await checkAuthState();
            } else {
                console.log("Token refresh failed or wasn't needed");
            }
        } catch (error) {
            console.error("Error during forced refresh:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const modifyTokenExpiry = async (minutesToExpiry: number) => {
        if (isLoading) return;
        setIsLoading(true);
        setLastAction(`Setting token to expire in ${minutesToExpiry} min`);

        try {
            const tokens = await new Promise<Record<string, any>>((resolve) => {
                chrome.storage.local.get(null, (result) => resolve(result));
            });

            if (!tokens[StorageKeys.AUTH_ID_TOKEN]) {
                console.log("No token found to modify");
                return;
            }

            // Parse the token
            const tokenParts = tokens[StorageKeys.AUTH_ID_TOKEN].split(".");
            const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/")));

            // Modify expiry time
            payload.exp = Math.floor(Date.now() / 1000) + (minutesToExpiry * 60);

            // Re-encode the payload
            const modifiedPayload = btoa(JSON.stringify(payload))
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=/g, "");

            // Create modified token
            const modifiedToken = `${tokenParts[0]}.${modifiedPayload}.${tokenParts[2]}`;

            // Store back
            await new Promise<void>((resolve) => {
                chrome.storage.local.set({ [StorageKeys.AUTH_ID_TOKEN]: modifiedToken }, () => resolve());
            });

            console.log(`Token modified to expire in ${minutesToExpiry} minutes`);

            // Wait a bit for storage to settle
            await new Promise(resolve => setTimeout(resolve, 500));
            await checkAuthState();
        } catch (error) {
            console.error("Error modifying token:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        if (isLoading) return;
        setIsLoading(true);
        setLastAction("Signing out");
        signOut();
        await new Promise(resolve => setTimeout(resolve, 500));
        await checkAuthState();
        setIsLoading(false);
    };

    // Initialize token info on component mount
    useEffect(() => {
        checkAuthState();
    }, [checkAuthState]);

    // Set up an interval to check auth state every second
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!isLoading) {
                await checkAuthState();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [checkAuthState, isLoading]);

    // Listen for storage changes
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes[StorageKeys.AUTH_ID_TOKEN]) {
                checkAuthState();
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, [checkAuthState]);

    return (
        <Card className="w-full mt-4 border-2 border-amber-200 bg-yellow-50">
            <CardHeader className="pb-2">
                <CardTitle className="text-amber-900">Authentication DevTools</CardTitle>
                <CardDescription className="text-amber-700">
                    Testing and debugging tools for authentication (Development mode only)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={() => checkAuthState()}
                            disabled={isLoading}
                        >
                            Check Auth State
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={forceTokenRefresh}
                            disabled={isLoading}
                        >
                            Force Token Refresh
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={() => modifyTokenExpiry(1)}
                            disabled={isLoading}
                        >
                            Set to Expire in 1min
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white"
                            onClick={() => modifyTokenExpiry(4)}
                            disabled={isLoading}
                        >
                            Set to Expire in 4min
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-white text-red-500"
                            onClick={handleSignOut}
                            disabled={isLoading}
                        >
                            Sign Out
                        </Button>
                    </div>

                    {isLoading && <div className="text-amber-600">Loading...</div>}

                    {lastAction && (
                        <div className="text-amber-700 text-xs">
                            Last action: {lastAction}
                        </div>
                    )}

                    {tokenInfo ? (
                        <div className="bg-white p-3 rounded-md text-sm">
                            <div className="grid grid-cols-2 gap-1">
                                <div className="font-semibold">Email:</div>
                                <div>{tokenInfo.email || CHECKLIST_NO_VALUE.NOT_FOUND}</div>

                                <div className="font-semibold">Expires:</div>
                                <div className={tokenInfo.isExpired ? "text-red-500" : ""}>
                                    {new Date(tokenInfo.exp * 1000).toLocaleString()}
                                </div>

                                <div className="font-semibold">Time remaining:</div>
                                <div className={tokenInfo.isExpired ? "text-red-500 font-bold" : ""}>
                                    {tokenInfo.timeRemaining}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-3 rounded-md text-sm">
                            No authentication token found
                        </div>
                    )}

                    <div className="text-xs text-amber-600">
                        This panel only appears in development mode
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DevTools; 