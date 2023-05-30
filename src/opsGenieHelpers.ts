import fetch from "cross-fetch"; // Using node-fetch for compatibility with Node.js
import { getParametersFromSSM } from "./helpers";

export enum Priority {
    P0 = "P0",
    P1 = "P1",
    P2 = "P2",
    P3 = "P3"
}

export const enum CartaAlerts {
    Schedule_Transactional_Send = "Schedule_Transactional_Send",
    Schedule_Personalized_Send = "Schedule_Personalized_Send",
    Schedule_Nonpersonalized_Send = "Schedule_Nonpersonalized_Send",
    Alert_Send = "Alert_Send",
    Ses_UsEast1 = "Ses_UsEast1",
    Ses_UsWest2 = "Ses_UsWest2",
    Metrics_Processing_Above_Threshshold = "Metrics_Processing_Above_Threshshold",
    File_Download_Processing_Delay = "File_Download_Processing_Delay"
}

interface AlertDetails {
    priority: Priority;
    message: string;
    description?: string;
}

const alertDetails: { [K in CartaAlerts]: AlertDetails } = {
    [CartaAlerts.Schedule_Transactional_Send]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Schedule_Personalized_Send]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Schedule_Nonpersonalized_Send]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Alert_Send]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Ses_UsEast1]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Ses_UsWest2]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Metrics_Processing_Above_Threshshold]: {
        priority: Priority.P2,
        message: "Events collection is backed up",
        description:
            "Check if the metrics processor is running and progressing through entries in the events collection"
    },
    [CartaAlerts.File_Download_Processing_Delay]: {
        priority: Priority.P2,
        message: "File download processing is delayed more than 15 mins"
    }
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

async function makeOpsGenieRequest(
    url: string,
    method: HttpMethod,
    data: any
): Promise<{
    result: string;
    took: number;
    requestId: string;
}> {
    try {
        const key = (await getParametersFromSSM(["ops.genie.api.key"]))[0]
            .value;

        const response = await fetch(url, {
            method: method,
            headers: {
                Authorization: `GenieKey ${key}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = (await response.json()) as {
            result: string;
            took: number;
            requestId: string;
        };
        return json;
    } catch (error) {
        console.error(`An error occurred while making the request: ${error}`);
    }
}

export async function createAlert(
    alias: keyof typeof CartaAlerts,
    customDescription?: string
) {
    const { message, priority, description } = alertDetails[alias];
    const json = await makeOpsGenieRequest(
        "https://api.opsgenie.com/v2/alerts",
        "POST",
        {
            message,
            alias,
            description:
                description ?? customDescription ?? "No description provided",
            priority
        }
    );
    console.log("Alert created successfully: " + JSON.stringify(json));
    return json;
}

export async function closeAlert(alias: keyof typeof CartaAlerts) {
    const json = await makeOpsGenieRequest(
        `https://api.opsgenie.com/v2/alerts/${alias}/close?identifierType=alias`,
        "POST",
        {
            body: {
                note: "Closing the alert automatically"
            }
        }
    );
    console.log("Alert closed successfully: " + JSON.stringify(json));
    return json;
}
