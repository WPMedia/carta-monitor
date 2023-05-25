import * as dotenv from "dotenv";
dotenv.config();
import Carta, { CartaServer } from "@washingtonpost/carta-client-lib";
import { DateTime } from "luxon";
import { CartaAlerts, closeAlert, createAlert } from "../opsGenieHelpers";

const createAndSendLetter = async (
    letterType: "nonPersonalized" | "personalized" | "transactional",
    campaignId: string
) => {
    const formattedDate = DateTime.fromJSDate(new Date()).toFormat(
        "yyyy-MM-dd HH:mm:ss"
    );
    const letterName = `p0-${letterType}-${formattedDate}`;
    console.log(`Creating letter ${letterName} on campaign ${campaignId}`);

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
    console.log(`Scheduled send for letter ${letterId}`);
};

module.exports.sendScheduling = async () => {
    try {
        await createAndSendLetter(
            "nonPersonalized",
            process.env.NONPERSONALIZED_CAMPAIGN_ID as string
        );
        await closeAlert(CartaAlerts.Schedule_Nonpersonalized_Send_Failed);
    } catch (error) {
        console.error(
            `Failed to schedule send of nonPersonalized letter ${error}`
        );
        await createAlert(CartaAlerts.Schedule_Nonpersonalized_Send_Failed);
        throw error;
    }

    // Personalized send
    try {
        await createAndSendLetter(
            "personalized",
            process.env.PERSONALIZED_CAMPAIGN_ID as string
        );
        await closeAlert(CartaAlerts.Schedule_Personalized_Send_Failed);
    } catch (error) {
        console.error(
            `Failed to schedule send of personalized letter ${error}`
        );
        await createAlert(CartaAlerts.Schedule_Personalized_Send_Failed);
        throw error;
    }

    // Transactional send
    try {
        await createAndSendLetter(
            "transactional",
            process.env.TRANSACTIONAL_CAMPAIGN_ID as string
        );
        await closeAlert(CartaAlerts.Schedule_Transactional_Send_Failed);
    } catch (error) {
        console.error(`Failed to schedule send of nonPers letter ${error}`);
        await createAlert(CartaAlerts.Schedule_Transactional_Send_Failed);
        throw error;
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
