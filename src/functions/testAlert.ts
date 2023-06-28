import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { closeOpenAlert, createAlert } from "../opsGenie";
import fetch from "cross-fetch"; // Using node-fetch for compatibility with Node.js
import { CartaAlerts } from "../alerts";
import { envVars } from "../environmentVariables";

export const testAlert = async () => {
    try {
        // Alert send via list management
        const ssmClient = new SSMClient({
            region: "us-east-1"
        });
        const getParameterCommand = new GetParameterCommand({
            Name: `/carta/${
                envVars.STAGE === "PROD" ? "prod" : "sandbox"
            }/list.management.user.token.carta.monitor`
        });

        const data = await ssmClient.send(getParameterCommand);
        const listManagementToken = data.Parameter?.Value;
        const body = JSON.stringify({
            campaign_name: envVars.ALERT_CAMPAIGN_NAME as string,
            send_time: Date.now(),
            variables: {
                emailList: [envVars.ALERT_EMAIL_LIST],
                literalJson: {
                    ln: "Carta",
                    fn: "Monitor"
                }
            }
        });
        const response = await fetch(
            envVars.LIST_MANAGEMENT_SEND_ALERT as string,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${listManagementToken}`
                },
                body
            }
        );
        const result = (await response.json()) as {
            status: "success" | "failure";
        };
        if (result.status === "success") {
            console.log("Successfully sent alert");
            await closeOpenAlert(CartaAlerts.Alert_Send);
            return;
        }
        throw new Error(
            `Alert fetch returned a failure response: ${JSON.stringify(
                result
            )}; ${envVars.LIST_MANAGEMENT_SEND_ALERT} with body: ${body}`
        );
    } catch (error) {
        console.error(`Failed to send alert: ${error}`);
        await createAlert(CartaAlerts.Alert_Send);
    }

    return {
        statusCode: 200,
        body: JSON.stringify("Success"),
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        }
    };
};
