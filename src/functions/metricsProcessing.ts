import middy from "@middy/core";
import { CartaAlerts } from "../alerts";
import { envVars } from "../environmentVariables";
import { getMongoDatabase } from "../mongo";
import { closeOpenAlert, createAlert } from "../opsGenie";
import { errorHandlerMiddleware } from "../errorMiddleware";

export const baseCheckMetricsProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const eventsCollection = db.collection("events");

    const eventsCount = await eventsCollection.estimatedDocumentCount();
    const threshhold = +envVars.METRICS_EVENTS_COUNT_ALERT_THRESHHOLD;

    console.log(
        `Current events count: ${eventsCount}. Set threshhold: ${threshhold}.`
    );
    if (eventsCount < threshhold) {
        await closeOpenAlert(CartaAlerts.Metrics_Processing_Above_Threshshold);
    } else {
        console.log(
            `Count ${eventsCount} above the events collection count threshold of ${threshhold}; opening alert`
        );
        await createAlert(CartaAlerts.Metrics_Processing_Above_Threshshold);
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

const handler = middy(baseCheckMetricsProcessing).use(errorHandlerMiddleware());

export { handler as checkMetricsProcessing };
