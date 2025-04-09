import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import React, { useCallback } from 'react';
import { FaCopy, FaTimes } from 'react-icons/fa';

interface AgentMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
}

export const AgentMessageModal: React.FC<AgentMessageModalProps> = ({
    isOpen,
    onClose,
    message,
}) => {
    const { toast } = useToast();

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(message);
            toast({
                title: "Copied!",
                description: "Message copied to clipboard.",
                variant: "default",
            });
        } catch (err) {
            console.error("Failed to copy text: ", err);
            toast({
                title: "Copy Failed",
                description: "Could not copy message to clipboard.",
                variant: "destructive",
            });
        }
    }, [message, toast]);

    if (!isOpen) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Generated Agent Message</DialogTitle>
                    <DialogDescription>
                        Copy the message below to send to the agent regarding missing information.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <textarea
                        readOnly
                        value={message}
                        className="min-h-[200px] text-sm p-2 border border-input rounded-md w-full bg-background text-foreground"
                    />
                </div>
                <DialogFooter className="sm:justify-between">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            <FaTimes className="mr-2 h-4 w-4" /> Close
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={handleCopy}>
                        <FaCopy className="mr-2 h-4 w-4" /> Copy Message
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 