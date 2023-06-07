import { closeOpenAlert, createAlert } from "../opsGenieHelpers";
import { NewsletterSend } from "./campaignSendAlerts";
import { findMostRecentSend, getMongoDatabase, Send } from "../mongo";
import { DateTime } from "luxon";
import { CartaAlerts } from "../alerts";

const alerts: Record<
    Send,
    {
        fifteenAlert: keyof typeof CartaAlerts;
        thirtyAlert: keyof typeof CartaAlerts;
    }
> = {
    alert: {
        fifteenAlert: CartaAlerts.No_Alerts_15_Minutes,
        thirtyAlert: CartaAlerts.No_Alerts_30_Minutes
    },
    transactional: {
        fifteenAlert: CartaAlerts.No_Transactional_Sends_15_Minutes,
        thirtyAlert: CartaAlerts.No_Transactional_Sends_30_Minutes
    },
    personalized: {
        fifteenAlert: CartaAlerts.No_Personalized_Sends_15_Minutes,
        thirtyAlert: CartaAlerts.No_Personalized_Sends_30_Minutes
    },
    nonpersonalized: {
        fifteenAlert: CartaAlerts.No_NonpersonalizedSends_15_Minutes,
        thirtyAlert: CartaAlerts.No_NonpersonalizedSends_30_Minutes
    }
};

const triggerAlert = async (
    mostRecentSend: NewsletterSend,
    alert: Send,
    now: DateTime
) => {
    const sendTime = DateTime.fromJSDate(mostRecentSend.statusDoneTimestamp);
    const utcNow = now.setZone("utc"); // convert to UTC to compare to UTC entry in mongo
    const fifteenMinutesAgo = utcNow.minus({ minutes: 15 });
    const thirtyMinutesAgo = utcNow.minus({ minutes: 30 });
    if (sendTime > fifteenMinutesAgo) {
        await closeOpenAlert(alerts[alert].thirtyAlert);
        await closeOpenAlert(alerts[alert].fifteenAlert);
    } else if (sendTime <= thirtyMinutesAgo) {
        console.log(
            `Latest "${alert}" with id ${
                mostRecentSend._id
            } sent at ${sendTime.toLocaleString(
                DateTime.DATETIME_SHORT
            )}, creating 30 minutes alert`
        );
        await createAlert(alerts[alert].thirtyAlert);
    } else if (sendTime <= fifteenMinutesAgo) {
        console.log(
            `Latest "${alert}" with id ${
                mostRecentSend._id
            } sent at ${sendTime.toLocaleString(
                DateTime.DATETIME_SHORT
            )}, creating 15 minutes alert`
        );
        await createAlert(alerts[alert].fifteenAlert);
    }
};

export const send = async () => {
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

    // If the function is running in a local environment (as specified by the IS_LOCAL environment variable),
    // we close the MongoDB client connection after the function execution is complete. This is done because
    // in a local environment (like when running tests or invoking the function manually), Node.js process
    // won't exit as long as there are open connections. However, in a production environment (e.g., on AWS Lambda),
    // connections are managed differently, so we want to keep them open for possible reuse across multiple
    // invocations of the function for performance reasons.
    if (process.env.IS_LOCAL) {
        await client.close();
    }
};
