import fetch from "cross-fetch"; // Using node-fetch for compatibility with Node.js
import { getParametersFromSSM } from "./helpers";
import { sendFilters } from "./mongo";

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
    No_Transactional_Sends_15_Minutes = "No_Transactional_Sends_15_Minutes",
    No_Personalized_Sends_15_Minutes = "No_Personalized_Sends_15_Minutes",
    No_NonpersonalizedSends_15_Minutes = "No_NonpersonalizedSends_15_Minutes",
    No_Alerts_15_Minutes = "No_Alerts_15_Minutes",
    No_Transactional_Sends_30_Minutes = "No_Transactional_Sends_30_Minutes",
    No_Personalized_Sends_30_Minutes = "No_Personalized_Sends_30_Minutes",
    No_NonpersonalizedSends_30_Minutes = "No_NonpersonalizedSends_30_Minutes",
    No_Alerts_30_Minutes = "No_Alerts_30_Minutes",
    Ses_UsEast1 = "Ses_UsEast1",
    Ses_UsWest2 = "Ses_UsWest2",
    Metrics_Processing_Above_Threshshold = "Metrics_Processing_Above_Threshshold",
    File_Download_Processing_Delay = "File_Download_Processing_Delay",
    Automatic_Dynamic_List = "Automatic_Dynamic_List",
    Scheduled_Dynamic_List = "Scheduled_Dynamic_List",
    Multiple_Campaign_Send_Delay = "Multiple_Campaign_Send_Delay"
}

interface AlertDetails {
    priority: Priority;
    message: string;
    description?: string;
}

const alertDetails: { [K in CartaAlerts]: AlertDetails } = {
    [CartaAlerts.Schedule_Transactional_Send]: {
        priority: Priority.P2,
        message: "Failed to schedule a transactional send"
    },
    [CartaAlerts.Schedule_Personalized_Send]: {
        priority: Priority.P2,
        message: "Failed to send a personalized send"
    },
    [CartaAlerts.Schedule_Nonpersonalized_Send]: {
        priority: Priority.P2,
        message: "Failed to send a nonpersonalized send"
    },
    [CartaAlerts.Alert_Send]: {
        priority: Priority.P1,
        message: "Failed to send an alert send"
    },
    [CartaAlerts.No_Transactional_Sends_15_Minutes]: {
        priority: Priority.P2,
        message: "Viewers don’t receive transactional emails in last 15 mins",
        description: `
        1. Check Transactional Campaign: ${
            process.env.TRANSACTIONAL_CAMPAIGN_ID
        }
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["transactional"]
        )}, sorted by statusDoneTimestamp.`
    },
    [CartaAlerts.No_Personalized_Sends_15_Minutes]: {
        priority: Priority.P2,
        message: "Viewers don’t receive personalized emails in last 15 mins",
        description: `
        1. Check Nonpersonalized Campaign: ${
            process.env.PERSONALIZED_CAMPAIGN_ID
        }       
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["personalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.No_NonpersonalizedSends_15_Minutes]: {
        priority: Priority.P2,
        message: "Viewers don’t receive nonpersonalized emails in last 15 mins",
        description: `
        1. Check Nonpersonalized Campaign: ${
            process.env.PERSONALIZED_CAMPAIGN_ID
        }
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["nonpersonalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.No_Alerts_15_Minutes]: {
        priority: Priority.P2,
        message: "Viewers don’t receive alerts in last 15 mins",
        description: `
        1. Check Alert Campaign: ${process.env.ALERT_CAMPAIGN_NAME}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["alert"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.No_Transactional_Sends_30_Minutes]: {
        priority: Priority.P1,
        message: "Viewers don’t receive transactional emails in last 30 mins",
        description: `
        1. Check Transactional Campaign: ${
            process.env.TRANSACTIONAL_CAMPAIGN_ID
        }
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["transactional"]
        )}, sorted by statusDoneTimestamp.`
    },
    [CartaAlerts.No_Personalized_Sends_30_Minutes]: {
        priority: Priority.P1,
        message: "Viewers don’t receive personalized emails in last 30 mins",
        description: `
        1. Check Nonpersonalized Campaign: ${
            process.env.PERSONALIZED_CAMPAIGN_ID
        }       
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["personalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.No_NonpersonalizedSends_30_Minutes]: {
        priority: Priority.P1,
        message: "Viewers don’t receive nonpersonalized emails in last 30 mins",
        description: `
        1. Check Nonpersonalized Campaign: ${
            process.env.NONPERSONALIZED_CAMPAIGN_ID
        }
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["nonpersonalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.No_Alerts_30_Minutes]: {
        priority: Priority.P1,
        message: "Viewers don’t receive alerts in last 30 mins",
        description: `
        1. Check Alert Campaign: ${process.env.ALERT_CAMPAIGN_NAME}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["alert"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.Ses_UsEast1]: {
        priority: Priority.P0,
        message: "Failed to send email via SES us-east-1"
    },
    [CartaAlerts.Ses_UsWest2]: {
        priority: Priority.P0,
        message: "Failed to send email via SES us-west-2"
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
    },
    [CartaAlerts.Scheduled_Dynamic_List]: {
        priority: Priority.P2,
        message: "Scheduled dynamic list(s) failed to run"
    },
    [CartaAlerts.Automatic_Dynamic_List]: {
        priority: Priority.P2,
        message: "Auto-running dynamic list(s) failed to run"
    },
    [CartaAlerts.Multiple_Campaign_Send_Delay]: {
        priority: Priority.P1,
        message: "Email send of multiple campaigns is delayed."
    }
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

async function makeOpsGenieRequest(
    url: string,
    method: HttpMethod,
    data?: any
): Promise<{
    result: string;
    took: number;
    requestId: string;
    data?: { count: number };
}> {
    const key = (await getParametersFromSSM(["ops.genie.api.key"]))[0].value;

    const response = await fetch(url, {
        method: method,
        headers: {
            Authorization: `GenieKey ${key}`,
            "Content-Type": "application/json"
        },
        body: !data ? undefined : JSON.stringify(data)
    });

    if (!response.ok) {
        throw response;
    }

    const json = (await response.json()) as {
        result: string;
        took: number;
        requestId: string;
    };
    return json;
}

export async function createAlert(
    alias: keyof typeof CartaAlerts,
    customDescription?: string
) {
    if (process.env.IS_LOCAL) {
        console.log(
            `Alert on local: ${JSON.stringify({ alias, customDescription })}`
        );
        return;
    }

    const { message, priority, description } = alertDetails[alias];
    const json = await makeOpsGenieRequest(
        "https://api.opsgenie.com/v2/alerts",
        "POST",
        {
            message: `[${
                process.env.OPS_GENIE_ENV?.toLocaleUpperCase() ?? "Undefined"
            }] ${message}`,
            alias,
            description:
                description ?? customDescription ?? "No description provided",
            priority
        }
    );
    console.log(`Alert ${alias} created successfully: ${JSON.stringify(json)}`);
    return json;
}

async function isAlertCurrentlyOpen(alias: keyof typeof CartaAlerts) {
    try {
        const json = await makeOpsGenieRequest(
            `https://api.opsgenie.com/v2/alerts/${alias}?identifierType=alias`,
            "GET"
        );
        return json?.data?.count > 0;
    } catch (error: unknown) {
        if ((error as Response).status === 404) return false;
        throw error;
    }
}

export async function closeOpenAlert(alias: keyof typeof CartaAlerts) {
    const isOpen = await isAlertCurrentlyOpen(alias);
    if (!isOpen) {
        return;
    }

    const json = await makeOpsGenieRequest(
        `https://api.opsgenie.com/v2/alerts/${alias}/close?identifierType=alias`,
        "POST",
        {
            body: {
                note: "Closing the alert via api called in carta-monitor"
            }
        }
    );
    console.log(`Closed alert ${alias}: ${JSON.stringify(json)}`);
    return json;
}

export async function escalateAlert(
    alias: keyof typeof CartaAlerts,
    newPriority: keyof typeof Priority
) {
    console.log(process.env);
    const json = await makeOpsGenieRequest(
        `https://api.opsgenie.com/v2/alerts/${alias}?identifierType=alias`,
        "PATCH",
        {
            priority: newPriority
        }
    );
    console.log(
        `Alert ${alias} escalated successfully to ${newPriority}: ${JSON.stringify(
            json
        )}`
    );
    return json;
}
