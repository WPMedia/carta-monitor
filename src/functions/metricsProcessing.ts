import { CartaAlerts } from "../alerts";
import { environmentVariables } from "../environmentVariables";
import { getMongoDatabase } from "../mongo";
import { closeOpenAlert, createAlert } from "../opsGenie";

// Our events collection reaches a peak size of approximately 13 million when the Post Most and our massive marketing
// send (with 2.7 million recipients) are dispatched around the same time.

// Therefore, we're setting the threshold to 20 million. This figure is large enough to prevent false positive alarms,
// even if the volume of the Post Most send keeps growing at the current rate.

// At the same time, a threshold of 20 million is still low enough for us to identify any processing issues with the
// day's sends by mid-afternoon.
const eventsCountAlertThreshold = 20000000; // Twenty million
export const checkMetricsProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const eventsCollection = db.collection("events");

    try {
        const eventsCount = await eventsCollection.estimatedDocumentCount();

        if (eventsCount < eventsCountAlertThreshold) {
            await closeOpenAlert(
                CartaAlerts.Metrics_Processing_Above_Threshshold
            );
        } else {
            console.log(
                "above the events collection count threshold; opening alert"
            );
            await createAlert(CartaAlerts.Metrics_Processing_Above_Threshshold);
        }
    } catch (error) {
        console.error(`An error occurred while processing metrics: ${error}`);
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
