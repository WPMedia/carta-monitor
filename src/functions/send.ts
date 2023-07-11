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

    console.log(
        `Most recent ${alert.toUpperCase()} ${sendTime.toRelativeCalendar()} at ${sendTime.toLocaleString(
            DateTime.TIME_24_SIMPLE
        )} (UTC), ${minutesAgo} minute(s) ago, with id ${mostRecentSend._id}`
    );

    if (minutesAgo < p2AlertMinutes) {
        await closeOpenAlert(alerts[alert]);
        return;
    }

    if (minutesAgo >= p2AlertMinutes) {
        console.log(
            `Latest "${alert}" with id ${
                mostRecentSend._id
            } sent at ${sendTime.toLocaleString(
                DateTime.DATETIME_SHORT
            )}, creating ${envVars.SEND_DELAY_P2_MINUTES} minutes alert`
        );
        await createAlert(alerts[alert]);
    }

    if (minutesAgo >= p1AlertMinutes) {
        console.log(
            `Latest "${alert}" with id ${
                mostRecentSend._id
            } sent at ${sendTime.toLocaleString(
                DateTime.DATETIME_SHORT
            )}, escalating alert`
        );
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
