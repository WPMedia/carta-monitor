import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

export enum Priority {
    P0 = "P0",
    P1 = "P1",
    P2 = "P2",
    P3 = "P3"
}

export const enum CartaAlerts {
    Schedule_Transactional_Send_Failed = "Schedule_Transactional_Send_Failed",
    Schedule_Personalized_Send_Failed = "Schedule_Personalized_Send_Failed",
    Schedule_Nonpersonalized_Send_Failed = "Schedule_Nonpersonalized_Send_Failed",
    Alert_Send_Failed = "Alert_Send_Failed",
    Ses_UsEast1_Failed = "Ses_UsEast1_Failed",
    Ses_UsWest2_Failed = "Ses_UsWest2_Failed"
}

interface AlertDetails {
    priority: Priority;
    message: string;
}

const alertDetails: { [K in CartaAlerts]: AlertDetails } = {
    [CartaAlerts.Schedule_Transactional_Send_Failed]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Schedule_Personalized_Send_Failed]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Schedule_Nonpersonalized_Send_Failed]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Alert_Send_Failed]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Ses_UsEast1_Failed]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    },
    [CartaAlerts.Ses_UsWest2_Failed]: {
        priority: Priority.P3,
        message: "Test alert, please ignore"
    }
};

const getOpsGenieKey = async () => {
    const ssmClient = new SSMClient({
        region: "us-east-1"
    });
    const getParameterCommand = new GetParameterCommand({
        Name: `/carta/${
            process.env.STAGE === "PROD" ? "prod" : "sandbox"
        }/ops.genie.api.key`
    });
    try {
        const data = await ssmClient.send(getParameterCommand);
        return data.Parameter.Value;
    } catch (error) {
        console.error(`Failed to fetch Ops genie key from SSM: ${error}`);
    }
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

// Todo -- infer types returned from response for type-safety
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
        const key = await getOpsGenieKey();
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
    description = "No description provided"
) {
    const { message, priority } = alertDetails[alias];
    const json = await makeOpsGenieRequest(
        "https://api.opsgenie.com/v2/alerts",
        "POST",
        {
            message,
            alias,
            description,
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

module.exports = {
    createAlert,
    closeAlert
};
