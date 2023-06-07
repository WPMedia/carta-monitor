import fetch from "cross-fetch"; // Using node-fetch for compatibility with Node.js
import { getParametersFromSSM } from "./helpers";
import { CartaAlerts, Priority, alertDetails } from "./alerts";

// Declare a variable at the global scope of the module.
// This variable will persist across multiple invocations of the Lambda function,
// as long as the same container is used.
// https://aws.amazon.com/blogs/compute/caching-data-and-configuration-settings-with-aws-lambda-extensions/
let opsGenieKey: string;
let opsGenieEnv: string;
let isLocal: boolean;

// As soon as this module is loaded, this self-invoking async function is run.
// It fetches the ops.genie.api.key SSM parameter and stores it in the 'opsGenieKey' variable.
// This is done outside of the handler function to cache the fetched parameter.
// Because the variable is cached at the container level,
// it doesn't need to be fetched every time the Lambda function is invoked.
// Instead, it's fetched only when the container starts.
(async () => {
    try {
        opsGenieKey = (await getParametersFromSSM(["ops.genie.api.key"]))[0]
            .value;
    } catch (error) {
        // Log the error and exit the process with a non-zero status code.
        console.error(`Failed to fetch the parameter from SSM: ${error}`);
        process.exit(1);
    }

    opsGenieEnv = process.env.OPS_GENIE_ENV;
    isLocal = JSON.parse(process.env.IS_LOCAL);
})();

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

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
    const response = await fetch(`https://api.opsgenie.com/v2/alerts/${path}`, {
        method: method,
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
    if (isLocal) {
        console.log(
            `Alert on local: ${JSON.stringify({ alias, customDescription })}`
        );
        return;
    }

    const { message, priority, description } = alertDetails[alias];
    const json = await makeOpsGenieRequest("", "POST", {
        message: `[${
            opsGenieEnv?.toLocaleUpperCase() ?? "Undefined"
        }] ${message}`,
        alias,
        description:
            description ?? customDescription ?? "No description provided",
        priority
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
