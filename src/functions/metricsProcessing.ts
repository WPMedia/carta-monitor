import { CartaAlerts } from "../alerts";
import { envVars } from "../environmentVariables";
import { getMongoDatabase } from "../mongo";
import { closeOpenAlert, createAlert } from "../opsGenie";

export const checkMetricsProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const eventsCollection = db.collection("events");

    try {
        const eventsCount = await eventsCollection.estimatedDocumentCount();

        if (eventsCount < +envVars.METRICS_EVENTS_COUNT_ALERT_THRESHHOLD) {
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
