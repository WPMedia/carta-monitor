import { closeOpenAlert, createAlert } from "../opsGenie";
import { NewsletterSend } from "./campaignSendAlerts";
import { findMostRecentSend, getMongoDatabase, Send } from "../mongo";
import { DateTime } from "luxon";
import { CartaAlerts } from "../alerts";
import { envVars } from "../environmentVariables";
import middy from "@middy/core";
import { errorHandlerMiddleware } from "../errorMiddleware";

const alerts: Record<
    Send,
    {
        p2Alert: keyof typeof CartaAlerts;
        p1Alert: keyof typeof CartaAlerts;
    }
> = {
    alert: {
        p2Alert: CartaAlerts.Alert_Send_Delay_P2,
        p1Alert: CartaAlerts.Alert_Send_Delay_P1
    },
    transactional: {
        p2Alert: CartaAlerts.Transactional_Send_Delay_P2,
        p1Alert: CartaAlerts.Transactional_Send_Delay_P1
    },
    personalized: {
        p2Alert: CartaAlerts.Personalized_Send_Delay_P2,
        p1Alert: CartaAlerts.Personalized_Send_Delay_P1
    },
    nonpersonalized: {
        p2Alert: CartaAlerts.NonPersonalized_Send_Delay_P2,
        p1Alert: CartaAlerts.NonPersonalized_Send_Delay_P1
    }
};

const triggerAlert = async (
    mostRecentSend: NewsletterSend,
    alert: Send,
    now: DateTime
) => {
    const sendTime = DateTime.fromJSDate(mostRecentSend.statusDoneTimestamp);
    const utcNow = now.setZone("utc"); // convert to UTC to compare to UTC entry in mongo
    const p2AlertMinutes = utcNow.minus({
        minutes: +envVars.SEND_DELAY_P2_MINUTES
    });
    const p1AlertMinutes = utcNow.minus({
        minutes: +envVars.SEND_DELAY_P1_MINUTES
    });
    if (sendTime > p2AlertMinutes) {
        await closeOpenAlert(alerts[alert].p1Alert);
        await closeOpenAlert(alerts[alert].p2Alert);
    } else if (sendTime <= p1AlertMinutes) {
        console.log(
            `Latest "${alert}" with id ${
                mostRecentSend._id
            } sent at ${sendTime.toLocaleString(
                DateTime.DATETIME_SHORT
            )}, creating 30 minutes alert`
        );
        await createAlert(alerts[alert].p1Alert);
    } else if (sendTime <= p2AlertMinutes) {
        console.log(
            `Latest "${alert}" with id ${
                mostRecentSend._id
            } sent at ${sendTime.toLocaleString(
                DateTime.DATETIME_SHORT
            )}, creating 15 minutes alert`
        );
        await createAlert(alerts[alert].p2Alert);
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
