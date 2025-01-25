import React, { useEffect, useState } from 'react';
import { ActionEvents } from '../constants/actionEvents';
import { generatePropertyChecklist } from '../constants/propertyChecklist';
import { retrieveDataForTab } from '../storage';
import { DataStatus } from '../types/property';
import { getStatusColor, getStatusIcon } from './helpers';

const App: React.FC = () => {
    const [propertyData, setPropertyData] = useState({
        price: null,
        location: null,
        bedrooms: null,
        bathrooms: null,
        images: null,
    });
    const [warningMessage, setWarningMessage] = useState<string | null>(null);

    useEffect(() => {
        retrieveDataForTab((data) => {
            if (data) {
                console.log('Data retrieved from chrome.storage', data);
                if (data.action === ActionEvents.UPDATE_PROPERTY_DATA) {
                    setPropertyData(data.propertyData);
                }
                if (data.action === ActionEvents.SHOW_WARNING) {
                    setWarningMessage(data.message);
                }
            }
        });
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
                                        fontWeight: item.status === DataStatus.MISSING ? "normal" : "bold"
                                    }}>
                                        {item.value || "Not found"}
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
