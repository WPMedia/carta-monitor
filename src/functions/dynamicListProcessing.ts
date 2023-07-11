import { Collection, Filter } from "mongodb";
import { getMongoDatabase } from "../mongo";
import { closeOpenAlert, createAlert } from "../opsGenie";
import { DateTime } from "luxon";
import { CartaAlerts } from "../alerts";
import middy from "@middy/core";
import { errorHandlerMiddleware } from "../errorMiddleware";

type List = {
    name: string;
};

/**
Generates alerts for tardy lists based on the provided filter and alert type.
@param {Collection<List>} lmListsCollection - The collection of lists to query.
@param {Filter<Document>} filter - The filter to apply when querying the lists collection.
@param {CartaAlerts} alertType - The type of alert to be generated.
@param {string} messagePrefix - The prefix to be included in the alert message.
@returns - A Promise that resolves when the handling is complete.
*/
const generateAlertsForTardyLists = async (
    lmListsCollection: Collection<List>,
    filter: Filter<{ name: string }>,
    alertType: CartaAlerts,
    messagePrefix: string
) => {
    const tardyList = await lmListsCollection.find(filter).toArray();

    if (tardyList.length > 0) {
        const tardyListNames = tardyList.map<string>((list) => list.name);
        const message = `${messagePrefix}: ${tardyListNames.join(",")}`;
        console.log(`Creating alert: ${message}`);
        await createAlert(alertType, message);
        return;
    }

    await closeOpenAlert(alertType);
};

export const getMostRecentQuarterHour = (now: DateTime) => {
    const diff = now.minute % 15;
    return now.minus({
        minutes: diff,
        seconds: now.second,
        milliseconds: now.millisecond
    });
};

const calculateQueryWindows = (now: DateTime) => {
    const mostRecentQuarterHour = getMostRecentQuarterHour(now);

    const startWindow = mostRecentQuarterHour.minus({ hours: 25, minutes: 45 });
    const startWindowHHmm = startWindow.toFormat("HHmm");

    const endWindow = mostRecentQuarterHour.minus({ hours: 25, minutes: 30 });
    let endWindowHHmm = endWindow.toFormat("HHmm");

    // Treat midnight as "2400" rather than "0000"
    if (endWindowHHmm === "0000") {
        endWindowHHmm = "2400";
    }

    return {
        startWindowIso: startWindow.toISO(),
        startWindowHHmm,
        endWindowIso: endWindow.toISO(),
        endWindowHHmm
    };
};

export const baseCheckDynamicListProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const { startWindowIso, startWindowHHmm, endWindowIso, endWindowHHmm } =
        calculateQueryWindows(DateTime.local());

    const lmListsCollection: Collection<List> = db.collection("lm_lists");

    const commonFilter = {
        type: "DYNAMIC",
        enabled: true,
        autorun: true,
        message: { $not: /Elasticsearch exception/ },
        updated_time: { $gte: startWindowIso, $lt: endWindowIso }
    };

    // Handle auto-running dynamic list(s)
    const autoRunningFilter = {
        ...commonFilter,
        autorun_time: { $in: [null, ""] }
    };
    await generateAlertsForTardyLists(
        lmListsCollection,
        autoRunningFilter,
        CartaAlerts.Automatic_Dynamic_List,
        "Auto-running dynamic list(s) failed to run"
    );

    // Handle scheduled dynamic list(s)
    const scheduledFilter = {
        ...commonFilter,
        autorun_time: {
            $nin: [null, ""],
            $gte: startWindowHHmm,
            $lt: endWindowHHmm
        }
    };
    await generateAlertsForTardyLists(
        lmListsCollection,
        scheduledFilter,
        CartaAlerts.Scheduled_Dynamic_List,
        "Scheduled dynamic list(s) failed to run"
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

const handler = middy(baseCheckDynamicListProcessing).use(
    errorHandlerMiddleware()
);

export { handler as checkDynamicListProcessing };
