import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";

const FeedbackToastContent: React.FC = () => {
    const [feedback, setFeedback] = useState<"initial" | "happy" | "medium" | "sad">("initial");

    // Determine title based on state
    const title =
        feedback === "initial" ? "How are you finding Vesta?" : "Feedback Received";

    return (
        <div className="p-4">
            {/* Title rendered inside the component */}
            <h4 className="mb-2 text-lg font-bold">{title}</h4>

            {feedback === "initial" && (
                <div className="flex space-x-2">
                    <button onClick={() => setFeedback("happy")} className="text-2xl">
                        😄
                    </button>
                    <button onClick={() => setFeedback("medium")} className="text-2xl">
                        😐
                    </button>
                    <button onClick={() => setFeedback("sad")} className="text-2xl">
                        😞
                    </button>
                </div>
            )}

            {feedback === "happy" && (
                <div>
                    <p>
                        We love that you're enjoying Vesta! Thanks for the positive
                        feedback!
                    </p>
                    <button className="mt-2 btn btn-primary">See More Happy Tips</button>
                </div>
            )}

            {feedback === "medium" && (
                <div>
                    <p>
                        Thanks for your feedback. We'll work on improving your experience!
                    </p>
                    <button className="mt-2 btn btn-warning">Learn How to Improve</button>
                </div>
            )}

            {feedback === "sad" && (
                <div>
                    <p>
                        We're sorry to hear that. We'll strive to address your concerns.
                    </p>
                    <button className="mt-2 btn btn-danger">Contact Support</button>
                </div>
            )}
        </div>
    );
};

const Feedback: React.FC = () => {
    const { toast } = useToast();

    // Show the toast when the component mounts
    React.useEffect(() => {
        toast({
            description: <FeedbackToastContent />,
            variant: "default",
        });
    }, [toast]);

    return null;
};

export default Feedback;
