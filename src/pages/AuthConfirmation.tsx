import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import React, { useEffect, useState } from "react";

export function AuthConfirmation({ onClose }: { onClose: () => void }) {
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setTimeout(() => {
                        onClose();
                    }, 500);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [onClose]);

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-muted/20">
            <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-lg text-center">
                <div className="flex justify-center mb-4">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <Check className="h-8 w-8 text-primary" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-2">Successfully Signed In</h2>
                <p className="text-muted-foreground mb-6">
                    You're now authenticated with Vesta Property Checker.
                </p>

                <p className="text-sm text-muted-foreground mb-4">
                    This window will close in {countdown} seconds
                </p>

                <Button onClick={onClose} className="w-full">
                    Close Now
                </Button>
            </div>
        </div>
    );
}

export default AuthConfirmation; 