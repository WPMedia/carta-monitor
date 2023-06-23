import { Collection, ObjectId } from "mongodb";
import { getMongoDatabase } from "../mongo";
import { DateTime } from "luxon";
import { closeOpenAlert, createAlert, escalateAlert } from "../opsGenie";
import { CartaAlerts } from "../alerts";
import { environmentVariables } from "../environmentVariables";

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

export type SendState = "done" | "warning" | "alarm";

const messages: Record<SendState, string> = {
    done: "now complete. Updating sendState to done",
    warning: "still incomplete. Updating sendState to warning",
    alarm: "is taking longer than expected. Updating sendState to alarm"
};

/**
 * Evaluate the send status of a newsletter
 *
 * @param {NewsletterSend} newsletterSend - The newsletter send object
 * @returns {null | { state: SendState; id: string }} - The state and id of the newsletter, or null if no sends have been attempted
 */
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

        // Configuration for send completion evaluation
        const sendEvaluationConfig = {
            sendsPerAllowedTimeSegment: 1000000, // For every 1,000,000 sends...
            minutesPerAllowedTimeSegment: 30, // ...30 minutes are allowed...
            successfulSendCompletionPercentage: 0.9 // ...for 90% of sends to complete
        };

        // Calculate the allotted time for a P1 alert. For every segment of attempted sends (defined by the configuration),
        // add a segment's worth of minutes to the threshold.
        // If less than one segment has been attempted, the minimum threshold is one segment's worth of time.
        const segmentCount = Math.floor(
            attemptedSendCount / sendEvaluationConfig.sendsPerAllowedTimeSegment
        );
        const allotedMinutesForP1Alert =
            (1 + Math.floor(segmentCount)) *
            sendEvaluationConfig.minutesPerAllowedTimeSegment;

        const additionalMinutesForP0Alert = 60;
        const allottedMinutesForP0Alert =
            allotedMinutesForP1Alert + additionalMinutesForP0Alert;

        let state: SendState;
        if (
            sentPercentage >=
            sendEvaluationConfig.successfulSendCompletionPercentage
        ) {
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
            `Email sending for letter(s) ${ids.join(", ")} ${
                messages[sendState]
            }`
        );
        await nlSendCollection.updateMany(
            { _id: { $in: ids.map((id) => id) } },
            { $set: { sendState } }
        );
    }
};

export const campaignSendAlerts = async () => {
    const { db, client } = await getMongoDatabase();

    const nlSend = db.collection<NewsletterSend>("nlSend");

    // nlSend records that have been scheduled to send in the last 24 hours
    // Ideally, we'd use scheduledSendTime, but that field is not indexed on nlSend,
    // and statusWaitTimestamp is indexed, and should be within a minute of statusWaitTimestamp
    const twentyFourHoursAgo = DateTime.now().minus({ days: 1 });
    const now = DateTime.now();
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

    const doneCampaignLetterIds: ObjectId[] = [];
    const warningCampaignLetterIds: ObjectId[] = [];
    const alarmCampaignLetterIds: ObjectId[] = [];
    eligibleRecentNewsletterSends.forEach((newsletterSend) => {
        const result = evaluateNewsletterSend(newsletterSend);
        if (result) {
            switch (result.state) {
                case "done":
                    doneCampaignLetterIds.push(result.id);
                    break;
                case "warning":
                    warningCampaignLetterIds.push(result.id);
                    break;
                case "alarm":
                    alarmCampaignLetterIds.push(result.id);
                    break;
                default:
                    break;
            }
        }
    });

    await updateSendState(nlSend, doneCampaignLetterIds, "done");
    await updateSendState(nlSend, warningCampaignLetterIds, "warning");
    await updateSendState(nlSend, alarmCampaignLetterIds, "alarm");

    if (
        warningCampaignLetterIds.length <= 1 &&
        alarmCampaignLetterIds.length === 0
    ) {
        closeOpenAlert(CartaAlerts.Multiple_Campaign_Send_Delay);
    }

    if (warningCampaignLetterIds.length > 1) {
        createAlert(
            CartaAlerts.Multiple_Campaign_Send_Delay,
            `<p><a href="${
                environmentVariables.CARTA_UI_BASE_URL
            }status">View</a> campaign send statuses on Carta</p>. Incomplete nlSend ids: "${warningCampaignLetterIds.join(
                ", "
            )}"`
        );
    }

    if (alarmCampaignLetterIds.length > 0) {
        escalateAlert(CartaAlerts.Multiple_Campaign_Send_Delay, "P0");
    }

    await client.close();
};
