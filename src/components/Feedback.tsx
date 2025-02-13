import { CHROME_EXTENSION_STORE_REVIEW_URL } from "@/constants/urls";
import { sendGA4Event } from "@/contentScript/utils/googleAnalytics";
import React, { useState } from "react";
import { Button } from "./ui/button";

const Feedback: React.FC = () => {
    const [feedback, setFeedback] = useState<"initial" | "happy" | "medium" | "sad" | "reviewingInChromeStore">("initial");
    const [writtenFeedback, setWrittenFeedback] = useState("");
    const [hoverRating, setHoverRating] = useState(0);

    const trackFeedbackAnalytics = (type: "happy" | "medium" | "sad") => {
        sendGA4Event("feedback_selected", {
            feedback_type: type,
        });
    };

    const handleFeedbackSelection = (type: "happy" | "medium" | "sad") => {
        trackFeedbackAnalytics(type);
        setFeedback(type);
    };

    const getTitle = (state: "initial" | "happy" | "medium" | "sad" | "reviewingInChromeStore") => {
        switch (state) {
            case "initial":
                return "How are you finding Vesta?";
            case "happy":
                return "Leave a review? ❤️";
            case "medium":
            case "sad":
                return "How could we improve? 🤔";
            case "reviewingInChromeStore":
                return "Almost there! 🎉";
            default:
                return "How could we improve? 🤔";
        }
    };

    const submitReview = () => {
        chrome.tabs.create({ url: CHROME_EXTENSION_STORE_REVIEW_URL }); // TODO: when published, update url
        setFeedback("reviewingInChromeStore");
    };

    const submitFeedback = () => {
        const mailtoLink = `mailto:j1mes@hotmail.co.uk?subject=Feedback on Vesta&body=${encodeURIComponent(writtenFeedback)}`;
        chrome.tabs.create({ url: mailtoLink });
    };

    return (
        <div>
            <h4 className="mb-2 text-lg font-bold">{getTitle(feedback)}</h4>

            {feedback === "initial" && (
                <div className="flex space-x-2 justify-evenly">
                    <button onClick={() => handleFeedbackSelection("happy")} className="text-2xl">
                        😄
                    </button>
                    <button onClick={() => handleFeedbackSelection("medium")} className="text-2xl">
                        😐
                    </button>
                    <button onClick={() => handleFeedbackSelection("sad")} className="text-2xl">
                        😞
                    </button>
                </div>
            )}

            {feedback === "happy" && (
                <div>
                    <p>It really helps us out - your good deed for the day!</p>
                    <button
                        onClick={submitReview}
                        onMouseLeave={() => setHoverRating(0)}
                        className="mt-2"
                    >
                        {[1, 2, 3, 4, 5].map((starNumber) => (
                            <span
                                key={starNumber}
                                onMouseEnter={() => setHoverRating(starNumber)}
                                style={{ cursor: "pointer", fontSize: "2rem", color: hoverRating >= starNumber ? "gold" : "lightgray" }}
                            >
                                {hoverRating >= starNumber ? "★" : "☆"}
                            </span>
                        ))}
                    </button>
                </div>
            )}
            {(feedback === "medium" || feedback === "sad") && (
                <div>
                    <p>Our small team values your feedback and want to improve. Please help us:</p>
                    <textarea
                        placeholder="Your feedback"
                        className="mt-2 block w-full h-32 p-2 border border-gray-300 rounded"
                        onChange={(e) => setWrittenFeedback(e.target.value)}
                        value={writtenFeedback}
                    />
                    <Button
                        onClick={submitFeedback}
                        className={`mt-2 btn`}
                        disabled={!writtenFeedback}
                    >
                        Email feedback
                    </Button>
                </div>
            )}
            {feedback === "reviewingInChromeStore" && (
                <div>
                    <p>
                        Please leave a review in the Chrome Extension Store
                        <br></br>
                        <span>←</span>
                    </p>
                </div>
            )}
        </div>
    );
};

export default Feedback;