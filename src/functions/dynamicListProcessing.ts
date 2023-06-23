import { Collection, Filter } from "mongodb";
import { getMongoDatabase } from "../mongo";
import { createAlert } from "../opsGenie";
import { DateTime } from "luxon";
import { CartaAlerts } from "../alerts";
import { environmentVariables } from "../environmentVariables";

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
    const tardyListNames = tardyList.map<string>((list) => list.name);

    if (tardyListNames.length > 0) {
        const message = `${messagePrefix}: ${tardyListNames.join(",")}`;
        console.log(`Creating alert: ${message}`);
        createAlert(alertType, message);
        return;
    }
    console.log(
        `Success: no results found when calling filter \n ${JSON.stringify(
            filter
        )}`
    );
};

/**
 * This function calculates the most recent quarter hour for a given DateTime.
 * It subtracts the remainder of the current minutes divided by 15 from the current minutes,
 * effectively rounding down to the most recent quarter hour.
 *
 * For example, if the current time is 10:18 AM, the most recent quarter hour would be 10:15 AM.
 *
 * @param now - The current DateTime from which the most recent quarter hour will be calculated.
 * @returns A DateTime object set to the most recent quarter hour.
 */
export const getMostRecentQuarterHour = (now: DateTime) => {
    const diff = now.minute % 15;
    return now.minus({
        minutes: diff,
        seconds: now.second,
        milliseconds: now.millisecond
    });
};

/**
 * This function calculates two specific time intervals (query windows), namely endWindow and startWindow,
 * based on the most recent quarter hour.
 *
 * These intervals are used to define the time range for the database queries. The aim is to target
 * a time frame which is precisely 25 hours, 30 minutes before the most recent quarter hour down to
 * 15 minutes before, thereby covering a quarter-hour long window of time.
 *
 * For example, if the most recent quarter hour was at 10:15 AM on May 31, 2023,
 * the endWindow would be at 8:45 AM on May 30, 2023 and the startWindow would be at 8:30 AM on the same day,
 * thereby covering the period between 8:45 AM to 8:30 AM on May 30, 2023.
 *
 * @param now - The current time from which the most recent quarter hour will be calculated.
 * @returns An object containing the endWindow and startWindow in both ISO and HHmm format.
 * - endWindowIso: The end of the query window in ISO format (25 hours, 30 minutes before the most recent quarter hour).
 * - startWindowIso: The start of the query window in ISO format (15 minutes before the endWindow).
 * - endWindowHHmm: The end of the query window in HHmm format. Midnight is treated as "2400" rather than "0000".
 * - startWindowHHmm: The start of the query window in HHmm format.
 */
const calculateQueryWindows = (now: DateTime) => {
    const mostRecentQuarterHour = getMostRecentQuarterHour(now);

    const endWindow = mostRecentQuarterHour.minus({ hours: 25, minutes: 30 });
    const startWindow = endWindow.minus({ minutes: 15 });

    let endWindowHHmm = endWindow.toFormat("HHmm");
    const startWindowHHmm = startWindow.toFormat("HHmm");

    // Treat midnight as "2400" rather than "0000"
    if (endWindowHHmm === "0000") {
        endWindowHHmm = "2400";
    }

    return {
        endWindowIso: endWindow.toISO(),
        startWindowIso: startWindow.toISO(),
        endWindowHHmm,
        startWindowHHmm
    };
};

export const checkDynamicListProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const { endWindowIso, startWindowIso, endWindowHHmm, startWindowHHmm } =
        calculateQueryWindows(DateTime.local());

    const lmListsCollection: Collection<List> = db.collection("lm_lists");

    const commonFilter = {
        type: "DYNAMIC",
        enabled: true,
        autorun: true,
        message: { $not: /Elasticsearch exception/ },
        updated_time: { $lt: endWindowIso, $gte: startWindowIso }
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
            $lt: endWindowHHmm,
            $gte: startWindowHHmm
        }
    };
    await generateAlertsForTardyLists(
        lmListsCollection,
        scheduledFilter,
        CartaAlerts.Scheduled_Dynamic_List,
        "Scheduled dynamic list(s) failed to run"
    );

    await client.close();
};
