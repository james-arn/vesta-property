import React, { useEffect, useState } from 'react';
import { ActionEvents } from '../constants/actionEvents';
import { generatePropertyChecklist } from '../propertychecklist/propertyChecklist';
import { DataStatus, ExtractedPropertyData } from '../types/property';
import { getStatusColor, getStatusIcon } from './helpers';

const emptyPropertyData: ExtractedPropertyData = {
    price: null,
    location: null,
    bedrooms: null,
    bathrooms: null,
    councilTax: null,
    size: null,
    propertyType: null,
    tenure: null,
    parking: null,
    heating: null,
    floorPlan: null,
    garden: null,
    epc: null,
    broadband: null,
    listingHistory: null,
    windows: null,
};

const App: React.FC = () => {
    const [propertyData, setPropertyData] = useState<ExtractedPropertyData>(emptyPropertyData);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);

    useEffect(() => {
        // **1. Add Message Listener First**
        const handleMessage = (message: { action: string; data?: any; message?: string }) => {
            console.log('[Side Panel] Received message:', message);
            if (message.action === ActionEvents.UPDATE_PROPERTY_DATA) {
                setPropertyData(message.data);
                setWarningMessage(null);
                console.log('[Side Panel] Property data updated:', message.data);
            } else if (message.action === ActionEvents.SHOW_WARNING) {
                setWarningMessage(message.message || null);
                setPropertyData(emptyPropertyData);
                console.log('[Side Panel] Warning message set:', message.message);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);

        // **2. Send 'SIDE_PANEL_OPENED' Message After Listener is Set Up**
        console.log('[Side Panel] Component mounted. Sending SIDE_PANEL_OPENED message.');
        chrome.runtime.sendMessage({ action: ActionEvents.SIDE_PANEL_OPENED }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Side Panel] Error sending SIDE_PANEL_OPENED message:', chrome.runtime.lastError);
            } else {
                console.log('[Side Panel] Background response:', response);
            }
        });

        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    const updatedChecklist = generatePropertyChecklist(propertyData);

    const initialOpenGroups = updatedChecklist.reduce((acc, item) => {
        acc[item.group] = true;
        return acc;
    }, {} as { [key: string]: boolean });

    const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>(initialOpenGroups);

    const toggleGroup = (group: string) => {
        setOpenGroups((prev) => ({
            ...prev,
            [group]: !prev[group],
        }));
    };

    let lastGroup = "";

    const handleEpcClick = (url: string) => {
        chrome.tabs.create({ url });
    };

    if (warningMessage) {
        return <div>{warningMessage}</div>;
    }

    return (
        <div style={{ padding: "0px 15px", fontFamily: "Arial, sans-serif" }}>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {updatedChecklist.map((item) => {
                    const showGroupHeading = item.group !== lastGroup;
                    lastGroup = item.group;

                    return (
                        <React.Fragment key={item.key}>
                            {showGroupHeading && (
                                <li
                                    style={{
                                        marginTop: "20px",
                                        fontWeight: "bold",
                                        fontSize: "1.2em",
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}
                                    onClick={() => toggleGroup(item.group)}
                                >
                                    <span>{item.group}</span>
                                    <span>{openGroups[item.group] ? "▼" : "▲"}</span>
                                </li>
                            )}
                            <div
                                style={{
                                    maxHeight: openGroups[item.group] ? "1000px" : "0",
                                    overflow: "hidden",
                                    transition: "max-height 0.3s ease, opacity 0.3s ease",
                                    opacity: openGroups[item.group] ? 1 : 0
                                }}
                            >
                                <li
                                    style={{
                                        color: getStatusColor(item.status),
                                        margin: "4px 0",
                                        padding: "8px",
                                        backgroundColor: "#f5f5f5",
                                        borderRadius: "4px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}
                                >
                                    <div>
                                        {getStatusIcon(item.status)} {item.label}
                                    </div>
                                    <div style={{
                                        marginLeft: "20px",
                                        color: "#333",
                                        fontWeight: item.status === DataStatus.ASK_AGENT ? "normal" : "bold"
                                    }}>
                                        {(item.key === 'epc' || item.key === 'floorPlan') && item.value !== 'Ask agent' ? (
                                            <span onClick={() => handleEpcClick(item.value ?? '')} style={{ cursor: 'pointer', color: 'blue', textDecoration: 'underline' }}>
                                                Yes
                                            </span>
                                        ) : (
                                            <span>{item.value || "Not found"}</span>
                                        )}
                                    </div>
                                </li>
                            </div>
                        </React.Fragment>
                    );
                })}
            </ul>
        </div>
    );
};

export default App;
