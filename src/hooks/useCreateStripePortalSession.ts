import { ENV_CONFIG } from "@/constants/environmentConfig";
import { toast } from "@/hooks/use-toast";
import { useCallback, useState } from "react";
import { useApiAuth } from "./useApiAuth";

export type PortalSessionResponse = {
  url: string;
};

const useCreateStripePortalSession = () => {
  const { fetchWithAuth, isLoading, error } = useApiAuth();
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const createPortalSession = useCallback(
    async (returnUrl?: string) => {
      try {
        const data = await fetchWithAuth<PortalSessionResponse>(
          `${ENV_CONFIG.VESTA_USER_ENDPOINT}/portal-session`,
          {
            method: "POST",
            body: returnUrl ? JSON.stringify({ returnUrl }) : undefined,
          }
        );

        setPortalUrl(data.url);

        // Optionally open the URL in a new tab
        if (data.url) {
          chrome.tabs.create({ url: data.url });
        }

        return data.url;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create portal session";
        toast({
          description: errorMessage,
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchWithAuth, ENV_CONFIG.VESTA_USER_ENDPOINT]
  );

  return { portalUrl, isLoading, error, createPortalSession };
};

export default useCreateStripePortalSession;
