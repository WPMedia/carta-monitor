import * as dotenv from "dotenv";
dotenv.config();
import { DateTime } from "luxon";
import { closeOpenAlert, createAlert } from "../opsGenie";
import { getCartaServer } from "../cartaServer";
import { CartaAlerts } from "../alerts";
import { Send } from "../mongo";
import { envVars } from "../environmentVariables";

export const createAndSendLetter = async (
    letterType: Send,
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

    if (!letterId) throw new Error(`Failed to create letter for ${campaignId}`);

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
    const sends: {
        letterType: Send;
        alertType: CartaAlerts;
        campaignId: string;
    }[] = [
        {
            letterType: "nonpersonalized",
            alertType: CartaAlerts.Schedule_Nonpersonalized_Send,
            campaignId: envVars.NONPERSONALIZED_CAMPAIGN_ID
        },
        {
            letterType: "personalized",
            alertType: CartaAlerts.Schedule_Personalized_Send,
            campaignId: envVars.PERSONALIZED_CAMPAIGN_ID
        },
        {
            letterType: "transactional",
            alertType: CartaAlerts.Schedule_Transactional_Send,
            campaignId: envVars.TRANSACTIONAL_CAMPAIGN_ID
        }
    ];
    for (const send of sends) {
        if (!send.campaignId) {
            throw new Error(
                `Missing ${send.letterType.toUpperCase()}_CAMPAIGN_ID in .env file`
            );
        }

        try {
            await createAndSendLetter(send.letterType, send.campaignId);
            await closeOpenAlert(send.alertType);
        } catch (error) {
            console.error(
                `Failed to schedule send of ${send.letterType} letter. Error: ${error.message}`
            );
            await createAlert(send.alertType);
        }
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
