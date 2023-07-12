import { closeOpenAlert, createAlert, escalateAlert } from "../opsGenie";
import { NewsletterSend } from "./campaignSendAlerts";
import { Send, findMostRecentSend, getMongoDatabase } from "../mongo";
import { DateTime } from "luxon";
import { CartaAlerts, Priority } from "../alerts";
import { envVars } from "../environmentVariables";
import middy from "@middy/core";
import { errorHandlerMiddleware } from "../errorMiddleware";

const alerts: Record<Send, CartaAlerts> = {
    alert: CartaAlerts.Alert_Send_Delay,
    transactional: CartaAlerts.Transactional_Send_Delay,
    personalized: CartaAlerts.Personalized_Send_Delay,
    nonpersonalized: CartaAlerts.NonPersonalized_Send_Delay
};

const triggerAlert = async (
    mostRecentSend: NewsletterSend,
    alert: Send,
    now: DateTime
) => {
    const sendTime = DateTime.fromJSDate(mostRecentSend.statusDoneTimestamp);
    const utcNow = now.setZone("utc"); // convert to UTC to compare to UTC entry in mongo
    const minutesAgo = Math.floor(utcNow.diff(sendTime, "minutes").minutes);
    const p2AlertMinutes = +envVars.SEND_DELAY_P2_MINUTES;
    const p1AlertMinutes = +envVars.SEND_DELAY_P1_MINUTES;

    const lastSendInfo = `Most recent ${alert.toUpperCase()} send ${minutesAgo} minute(s) ago. letterId: ${
        mostRecentSend.letterId
    }. nlSendId: ${mostRecentSend._id}`;
    console.log(lastSendInfo);

    if (minutesAgo < p2AlertMinutes) {
        await closeOpenAlert(alerts[alert]);
        return;
    }

    if (minutesAgo >= p2AlertMinutes) {
        console.log(`At least ${p2AlertMinutes} delay, creating alert`);
        await createAlert(alerts[alert], lastSendInfo);
    }

    if (minutesAgo >= p1AlertMinutes) {
        console.log(`At least ${p1AlertMinutes} delay, escalating alert`);
        await escalateAlert(alerts[alert], Priority.P1);
    }
};

export const baseSend = async () => {
    const { db, client } = await getMongoDatabase();
    const nlSendCollection = db.collection<NewsletterSend>("nlSend");

    const sendTypes: Send[] = [
        "alert",
        "transactional",
        "personalized",
        "nonpersonalized"
    ];
    await Promise.all(
        sendTypes.map(async (send) => {
            const recentSend = await findMostRecentSend(nlSendCollection, send);
            const now = DateTime.now();
            if (recentSend) await triggerAlert(recentSend, send, now);
        })
    );

    await client.close();

    return {
        statusCode: 200,
        body: JSON.stringify("Success"),
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        }
    };
};

const handler = middy(baseSend).use(errorHandlerMiddleware());

export { handler as send };
