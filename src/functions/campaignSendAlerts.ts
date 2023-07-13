import { Collection, ObjectId } from "mongodb";
import { getMongoDatabase } from "../mongo";
import { DateTime } from "luxon";
import { closeOpenAlert, createAlert, escalateAlert } from "../opsGenie";
import { CartaAlerts } from "../alerts";
import { envVars } from "../environmentVariables";
import middy from "@middy/core";
import { errorHandlerMiddleware } from "../errorMiddleware";

export type NewsletterSend = {
    _id: ObjectId;
    letterId: string;
    metricsSentEmails: number;
    metricsSentEmailsErr: number;
    scheduledSendTime: string;
    sendState?: SendState;
    statusWaitTimestamp: number;
    totalSendSize: number;
    statusDoneTimestamp: Date;
};

export type SendState =
    | "done" // Considered "complete"
    | "warning" // Considered "incomplete" (P1 send delay)
    | "alarm"; // Taking longer than expected (P0 send delay)

export const evaluateNewsletterSend = (
    newsletterSend: NewsletterSend
): null | { state: SendState; id: ObjectId } => {
    const minutesSinceScheduledSend = Math.abs(
        DateTime.fromISO(newsletterSend.scheduledSendTime)
            .diffNow("minutes")
            .toObject().minutes
    );
    const sentSuccessfulCount = newsletterSend.metricsSentEmails ?? 0;
    const sentFailedCount = newsletterSend.metricsSentEmailsErr ?? 0;
    const attemptedSendCount = sentSuccessfulCount + sentFailedCount;

    if (attemptedSendCount > 0) {
        const sentPercentage = sentSuccessfulCount / attemptedSendCount;

        // Calculate the allotted time for a P1 alert. For every segment of attempted sends (defined by the configuration),
        // add a segment's worth of minutes to the threshold.
        // If less than one segment has been attempted, the minimum threshold is one segment's worth of time.
        const segmentCount = Math.floor(
            attemptedSendCount / +envVars.SENDS_PER_ALLOWED_TIME_SEGMENT
        );
        const allotedMinutesForP1Alert =
            (1 + Math.floor(segmentCount)) *
            +envVars.MINUTES_PER_ALLOWED_TIME_SEGMENT;

        const additionalMinutesForP0Alert = 60;
        const allottedMinutesForP0Alert =
            allotedMinutesForP1Alert + additionalMinutesForP0Alert;

        let state: SendState;
        if (sentPercentage >= +envVars.SUCCESSFUL_SEND_COMPLETION_PERCENTAGE) {
            state = "done";
        } else if (minutesSinceScheduledSend > allottedMinutesForP0Alert) {
            state = "alarm";
        } else if (minutesSinceScheduledSend > allotedMinutesForP1Alert) {
            state = "warning";
        } else {
            return null;
        }

        return { state, id: newsletterSend._id };
    }
    return null;
};

/**
 * Update the send state of the newsletters in the database
 *
 * @param {Collection<NewsletterSend>} nlSendCollection - The newsletter send collection
 * @param {string[]} ids - The ids of the newsletters to update
 * @param {"done" | "warning" | "alarm"} sendState - The new send state
 */
export const updateSendState = async (
    nlSendCollection: Collection<NewsletterSend>,
    ids: ObjectId[],
    sendState: "done" | "warning" | "alarm"
) => {
    if (ids.length > 0) {
        console.log(
            `Marking the following nlSend id(s) as "${sendState}": ${ids.join(
                ", "
            )}`
        );
        await nlSendCollection.updateMany(
            { _id: { $in: ids.map((id) => id) } },
            { $set: { sendState } }
        );
    }
};

export const baseCampaignSendAlerts = async () => {
    const { db, client } = await getMongoDatabase();

    const nlSend = db.collection<NewsletterSend>("nlSend");

    // nlSend records that have been scheduled to send in the last 24 hours
    // Ideally, we'd use scheduledSendTime, but that field is not indexed on nlSend,
    // and statusWaitTimestamp is indexed, and should be within a minute of scheduledSendTime
    const now = DateTime.now();
    const twentyFourHoursAgo = now.minus({ days: 1 });
    const recentNlSendsQuery = {
        statusWaitTimestamp: {
            $gte: twentyFourHoursAgo.toMillis(),
            $lte: now.toMillis()
        }
    };

    // nlSend records that are not currently marked as done for their send state
    const sendStateNotDoneQuery = {
        sendState: { $ne: "done" as SendState }
    };

    // nlSend records that were intended to send to more than 100 users, to avoid false positives on small sends
    const minSendSize = 100;
    const minSizeQuery = {
        totalSendSize: { $gt: minSendSize }
    };

    // Fetch recent newsletter sends that haven't completed and are above the minimum send size
    const eligibleRecentNewsletterSends = await nlSend
        .find({
            $and: [recentNlSendsQuery, sendStateNotDoneQuery, minSizeQuery]
        })
        .toArray();

    if (eligibleRecentNewsletterSends.length === 0) {
        console.log("No pending newsletter sends found");
        await closeOpenAlert(CartaAlerts.Multiple_Campaign_Send_Delay);
        return {
            statusCode: 200,
            body: JSON.stringify("Success"),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }

    console.log(
        `nlSend records that are A) sendState !== "done", B) scheduled in the last 24 hours, and C) send size greater than ${minSendSize}: ${eligibleRecentNewsletterSends
            .map((s) => s._id)
            .join(", ")}`
    );

    const results = eligibleRecentNewsletterSends
        .map(evaluateNewsletterSend)
        .filter(Boolean);

    const doneCampaignLetterIds = results
        .filter((result) => result.state === "done")
        .map((result) => result.id);
    const warningCampaignLetterIds = results
        .filter((result) => result.state === "warning")
        .map((result) => result.id);
    const alarmCampaignLetterIds = results
        .filter((result) => result.state === "alarm")
        .map((result) => result.id);

    await updateSendState(nlSend, doneCampaignLetterIds, "done");
    await updateSendState(nlSend, warningCampaignLetterIds, "warning");
    await updateSendState(nlSend, alarmCampaignLetterIds, "alarm");

    if (
        warningCampaignLetterIds.length <= 1 &&
        alarmCampaignLetterIds.length === 0
    ) {
        await closeOpenAlert(CartaAlerts.Multiple_Campaign_Send_Delay);
    }

    if (warningCampaignLetterIds.length > 1) {
        await createAlert(
            CartaAlerts.Multiple_Campaign_Send_Delay,
            `<p><a href="${
                envVars.CARTA_UI_BASE_URL
            }status">View</a> campaign send statuses on Carta</p>. Incomplete nlSend ids: "${warningCampaignLetterIds.join(
                ", "
            )}"`
        );
    }

    if (alarmCampaignLetterIds.length > 0) {
        await escalateAlert(CartaAlerts.Multiple_Campaign_Send_Delay, "P0");
    }

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

const handler = middy(baseCampaignSendAlerts).use(errorHandlerMiddleware());

export { handler as campaignSendAlerts };
