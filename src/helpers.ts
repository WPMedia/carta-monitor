import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

type ParameterResult = {
    key: string;
    value: string | undefined;
};

const ssmCache: Record<string, string | undefined> = {};

/**
 * Fetches a list of keys from AWS Simple Systems Manager (SSM).
 *
 * @param {string[]} keys - The list of keys to retrieve from SSM.
 * @returns {Promise<ParameterResult[]>} An array of objects each containing a key and its corresponding value.
 * Each object has the form { key: string, value: string | undefined }.
 * If a key does not exist, its value will be undefined.
 *
 * @example
 *
 * getParametersFromSSM(['ops.genie.api.key', 'another.key'])
 *  .then(results => console.log(results))
 *  .catch(error => console.error(error));
 *
 * @throws Will log an error to the console if it fails to fetch a key from SSM.
 */
export const getParametersFromSSM = async (
    keys: string[]
): Promise<ParameterResult[]> => {
    const ssmClient = new SSMClient({ region: "us-east-1" });

    const results: ParameterResult[] = [];

    for (const key of keys) {
        if (ssmCache[key]) {
            results.push({
                key: key,
                value: ssmCache[key]
            });
            continue;
        }

        const parameterName = `/carta/${
            getEnvCache().STAGE === "PROD" ? "prod" : "sandbox"
        }/${key}`;

        const getParameterCommand = new GetParameterCommand({
            Name: parameterName
        });

        try {
            const data = await ssmClient.send(getParameterCommand);
            const value = data.Parameter?.Value;
            results.push({
                key: key,
                value: value
            });

            // Cache the fetched value
            ssmCache[key] = value;
        } catch (error) {
            console.error(`Failed to fetch ${key} from SSM: ${error}`);
            throw error;
        }
    }

    return results;
};

enum EnvVars {
    NONPERSONALIZED_CAMPAIGN_ID = "NONPERSONALIZED_CAMPAIGN_ID",
    PERSONALIZED_CAMPAIGN_ID = "PERSONALIZED_CAMPAIGN_ID",
    TRANSACTIONAL_CAMPAIGN_ID = "TRANSACTIONAL_CAMPAIGN_ID",
    LIST_MANAGEMENT_SEND_ALERT = "LIST_MANAGEMENT_SEND_ALERT",
    ALERT_CAMPAIGN_NAME = "ALERT_CAMPAIGN_NAME",
    ALERT_EMAIL_LIST = "ALERT_EMAIL_LIST",
    OPS_GENIE_ENV = "OPS_GENIE_ENV",
    MONGODB_NAME = "MONGODB_NAME",
    MONGODB_URI = "MONGODB_URI",
    CARTA_UI_BASE_URL = "CARTA_UI_BASE_URL",
    NONPERSONALIZED_SENDER_URL = "NONPERSONALIZED_SENDER_URL",
    STAGE = "STAGE",
    IS_LOCAL = "IS_LOCAL"
}

type EnvVarValues = { [K in EnvVars]?: string };

let envCache: EnvVarValues;

const getAndCheckRequiredEnvVars = () => {
    for (const varName of Object.values(EnvVars)) {
        const value = process.env[varName];
        if (!value) {
            throw new Error(`Missing ${varName} in environment variables`);
        } else {
            envCache[varName as EnvVars] = value;
        }
    }
};

export const getEnvCache = (): EnvVarValues => {
    if (!envCache) {
        envCache = {};
        getAndCheckRequiredEnvVars();
    }
    return envCache;
};
