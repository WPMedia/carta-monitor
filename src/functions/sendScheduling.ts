import * as dotenv from "dotenv";
dotenv.config();
import { DateTime } from "luxon";
import { CartaAlerts, closeOpenAlert, createAlert } from "../opsGenieHelpers";
import { getCartaServer } from "../cartaServer";

const createAndSendLetter = async (
    letterType: "nonPersonalized" | "personalized" | "transactional",
    campaignId: string
) => {
    const formattedDate = DateTime.fromJSDate(new Date()).toFormat(
        "yyyy-MM-dd HH:mm:ss"
    );
    const letterName = `p0-${letterType}-${formattedDate}`;
    console.log(`Creating letter ${letterName} on campaign ${campaignId}`);

    const server = getCartaServer();

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
    console.log(`Scheduled send for ${letterType} letter ${letterId}`);
};

export const sendScheduling = async () => {
    try {
        await createAndSendLetter(
            "nonPersonalized",
            process.env.NONPERSONALIZED_CAMPAIGN_ID as string
        );
        await closeOpenAlert(CartaAlerts.Schedule_Nonpersonalized_Send);
    } catch (error) {
        console.error(
            `Failed to schedule send of nonPersonalized letter ${error}`
        );
        await createAlert(CartaAlerts.Schedule_Nonpersonalized_Send);
        throw error;
    }

    // Personalized send
    try {
        await createAndSendLetter(
            "personalized",
            process.env.PERSONALIZED_CAMPAIGN_ID as string
        );
        await closeOpenAlert(CartaAlerts.Schedule_Personalized_Send);
    } catch (error) {
        console.error(
            `Failed to schedule send of personalized letter ${error}`
        );
        await createAlert(CartaAlerts.Schedule_Personalized_Send);
        throw error;
    }

    // Transactional send
    try {
        await createAndSendLetter(
            "transactional",
            process.env.TRANSACTIONAL_CAMPAIGN_ID as string
        );
        await closeOpenAlert(CartaAlerts.Schedule_Transactional_Send);
    } catch (error) {
        console.error(`Failed to schedule send of nonPers letter ${error}`);
        await createAlert(CartaAlerts.Schedule_Transactional_Send);
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
