import opsgenie from "opsgenie-sdk";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

export enum CartaNotificationSeverity {
    P0 = "P0",
    P1 = "P1",
    P2 = "P2",
    P3 = "P3"
}

const initialize = async () => {
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
        const opsGenieApiKey = data.Parameter.Value;

        opsgenie.configure({
            api_key: opsGenieApiKey
        });
    } catch (error) {
        console.error(`Failed to fetch Ops genie key from SSM: ${error}`);
    }
};

export const createOpsgenieAlert = (
    type: "sending" | "delivery" | "file_download",
    message: string,
    description: string,
    severity: CartaNotificationSeverity
) => {
    console.log(
        `Entering alert state for ${type} severity ${severity} ${message}`
    );
    initialize();
    opsgenie.alertV2.create(
        {
            message: `[${process.env.OPS_GENIE_ENV}]: ${message}`,
            description,
            alias: "abcd",
            severity:
                //Carta has a P0, but OpsGenie does not. Use OpsGenie's P1 for our P0 as well
                severity === CartaNotificationSeverity.P0
                    ? CartaNotificationSeverity.P1
                    : severity
        },
        (error: any, alert: any) => {
            if (error) {
                console.error(error);
            } else {
                console.log("Create Alert Response:");
                console.log(alert);
            }
        }
    );
};
