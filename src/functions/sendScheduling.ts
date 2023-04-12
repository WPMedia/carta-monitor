import * as dotenv from "dotenv";
dotenv.config();
import Carta, { CartaServer } from "@washingtonpost/carta-client-lib";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import fetch from "cross-fetch";

const createAndSendLetter = async (letterName: string, campaignId: string) => {
    const server = new CartaServer(
        process.env.STAGE === "prod" ? Carta.Servers.PROD : Carta.Servers.TEST
    );

    const letterId = (await server.Letters.createLetter(letterName, campaignId))
        .updatedDocId as string;
    console.log(`Created letter ${letterId} on campaign ${campaignId}`);

    const successfulScheduleSend =
        (
            (await server.Letters.sendFinal(letterId, campaignId, "scheduled", [
                Date.now()
            ])) as { status: "success" | "failure" }
        ).status === "success";

    if (!successfulScheduleSend)
        throw new Error("Send letter endpoint returned a failure");
    console.log(`Schedule send for letter ${letterId}`);
};

module.exports.sendScheduling = async () => {
    // Nonpersonalized send
    try {
        createAndSendLetter(
            `p0-nonPersonalized-${new Date()}`,
            process.env.NONPERSONALIZED_CAMPAIGN_ID as string
        );
    } catch (error) {
        console.error(
            `Failed to schedule send of nonPersonalized letter ${error}`
        );
    }

    // Personalized send
    try {
        createAndSendLetter(
            `p0-personalized-${new Date()}`,
            process.env.PERSONALIZED_CAMPAIGN_ID as string
        );
    } catch (error) {
        console.error(
            `Failed to schedule send of personalized letter ${error}`
        );
    }

    // Transactional send
    try {
        createAndSendLetter(
            `p0-transactional-${new Date()}`,
            process.env.TRANSACTIONAL_CAMPAIGN_ID as string
        );
    } catch (error) {
        console.error(`Failed to schedule send of nonPers letter ${error}`);
    }

    // Alert send via list management
    const ssmClient = new SSMClient({
        region: "us-east-1"
    });
    const getParameterCommand = new GetParameterCommand({
        Name: `/carta/${
            process.env.STAGE === "PROD" ? "prod" : "sandbox"
        }/list.management.user.token.carta.monitor`
    });
    try {
        const data = await ssmClient.send(getParameterCommand);
        const listManagementToken = data.Parameter.Value;
        try {
            const response = await fetch(
                process.env.LIST_MANAGEMENT_SEND_ALERT as string,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${listManagementToken}`
                    },
                    body: JSON.stringify({
                        campaign_name: process.env
                            .ALERT_CAMPAIGN_NAME as string,
                        send_time: Date.now(),
                        variables: {
                            emailList: [process.env.ALERT_EMAIL_LIST],
                            literalJson: {
                                ln: "Carta",
                                fn: "Monitor"
                            }
                        }
                    })
                }
            );
            const success = (await response.json()) as {
                success: "success" | "failure";
            };
            if (!success) throw new Error("Alert endpoint returned a failure");

            console.log(
                `Sent alert ${process.env.ALERT_CAMPAIGN_NAME} to ${process.env.ALERT_EMAIL_LIST}`
            );
        } catch (error) {
            console.error(`Failed to send alert" ${error}`);
        }
    } catch (error) {
        console.error(`Failed to get SSM parameters: ${error}`);
    }
};
