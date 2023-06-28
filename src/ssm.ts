import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { envVars } from "./environmentVariables";

const ssmParameterKeys = [
    "mongodb.password",
    "ops.genie.api.key",
    "carta.sender.endpoint.access.key"
] as const;

type SsmParameterKeysLiteral = (typeof ssmParameterKeys)[number];

let ssmCache: { [K in SsmParameterKeysLiteral]: string };

const ssmClient = new SSMClient({ region: "us-east-1" });

const getParametersFromSSM = async (): Promise<{
    [K in SsmParameterKeysLiteral]: string;
}> => {
    const results: Partial<{ [K in SsmParameterKeysLiteral]: string }> = {};

    for (const key of ssmParameterKeys) {
        const parameterName = `/carta/${
            envVars.STAGE === "PROD" ? "prod" : "sandbox"
        }/${key}`;

        const getParameterCommand = new GetParameterCommand({
            Name: parameterName
        });

        try {
            const data = await ssmClient.send(getParameterCommand);
            const value = data.Parameter?.Value;

            if (value) {
                results[key] = value;
            } else {
                throw new Error(`Parameter ${key} was not found.`);
            }
        } catch (error) {
            console.error(
                `Failed to fetch ${parameterName} from SSM: ${error}`
            );
            throw error;
        }
    }

    for (const key of ssmParameterKeys) {
        if (!results[key]) {
            throw new Error(
                `Failed to fetch all SSM parameters. Missing ${key}.`
            );
        }
    }

    if (isComplete(results)) {
        return results;
    } else {
        throw new Error(
            `Failed to fetch all SSM parameters. One or more of these keys are missing: ${ssmParameterKeys.join(
                ", "
            )}`
        );
    }
};

// Type guard to check if all parameters are fetched
const isComplete = (
    params: Partial<{ [K in SsmParameterKeysLiteral]: string }>
): params is { [K in SsmParameterKeysLiteral]: string } => {
    return ssmParameterKeys.every((key) => key in params);
};

export const getSsmCache = async () => {
    if (ssmCache) return ssmCache;

    const ssmParameters = await getParametersFromSSM();
    ssmCache = ssmParameters;
    return ssmCache;
};
