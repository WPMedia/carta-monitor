import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

type ParameterResult = {
    key: string;
    value: string | undefined;
};

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
        const parameterName = `/carta/${
            process.env.STAGE === "PROD" ? "prod" : "sandbox"
        }/${key}`;

        const getParameterCommand = new GetParameterCommand({
            Name: parameterName
        });

        try {
            const data = await ssmClient.send(getParameterCommand);
            results.push({
                key: key,
                value: data.Parameter?.Value
            });
        } catch (error) {
            console.error(`Failed to fetch ${key} from SSM: ${error}`);
        }
    }

    return results;
};
