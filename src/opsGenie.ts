import fetch from "cross-fetch";
import { CartaAlerts, Priority, alertDetails } from "./alerts";
import { environmentVariables } from "./environmentVariables";
import { getSsmCache } from "./ssm";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

const OPS_GENIE_BASE_URL = `https://api.opsgenie.com/v2/alerts/`;

async function makeOpsGenieRequest(
    path: string,
    method: HttpMethod,
    data?: any
): Promise<{
    result: string;
    took: number;
    requestId: string;
    data?: { count: number };
}> {
    const ssmCache = await getSsmCache();
    const opsGenieKey = ssmCache["ops.genie.api.key"];

    const endpoint = `${OPS_GENIE_BASE_URL}${path}`;
    const response = await fetch(endpoint, {
        method,
        headers: {
            Authorization: `GenieKey ${opsGenieKey}`,
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
    if (environmentVariables.IS_LOCAL) {
        console.log(
            `Alert on local: ${JSON.stringify({ alias, customDescription })}`
        );
        return;
    }

    const { message, priority, description } = alertDetails[alias];

    // If non-prod environment, only ever throw a P3
    const environmentPriority =
        environmentVariables.STAGE === "prod" ? priority : Priority.P3;

    const json = await makeOpsGenieRequest("", "POST", {
        message: `[${
            environmentVariables.OPS_GENIE_ENV.toLocaleUpperCase() ??
            "Undefined"
        }] ${message}`,
        alias,
        description:
            description ?? customDescription ?? "No description provided",
        priority: environmentPriority
    });
    console.log(`Alert ${alias} created successfully: ${JSON.stringify(json)}`);
    return json;
}

async function isAlertCurrentlyOpen(alias: keyof typeof CartaAlerts) {
    try {
        const json = await makeOpsGenieRequest(
            `${alias}?identifierType=alias`,
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
        `${alias}/close?identifierType=alias`,
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
    const json = await makeOpsGenieRequest(
        `${alias}?identifierType=alias`,
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
