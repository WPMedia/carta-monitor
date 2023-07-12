import { DateTime } from "luxon";
import { CartaAlerts } from "../alerts";
import { getMongoDatabase } from "../mongo";
import { closeOpenAlert, createAlert } from "../opsGenie";
import { envVars } from "../environmentVariables";
import middy from "@middy/core";
import { errorHandlerMiddleware } from "../errorMiddleware";

const generateProcessingMessage = (listNames: string[]) => {
    const message = `${
        listNames.length
    } file(s) currently processing: ${listNames.join(", ")}.
0. Sometimes a false postive, like when Marcy was running a test on Dynamic Lists. Can reach out to her to confirm.
1. Go to CartaWashPostProd mongo db collection and query file_download_details collection
   a. Verify at least one list is processing (status = processing), and its processed_count increases when you refresh
2. If none are processing, more investigation is required (is the Java process running?)
3. Verify your list is either status processing or submitted. If submitted, it is in the queue, and you should just keep an eye out to make sure the lists get queued eventually. Do not kill a download until someone makes a very strong case that their backed-up list download is urgent. May want to check in with user who triggered the list to let them know it is taking a while (found under user key in collection)`;

    return message;
};

export const baseCheckFileDownloadProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const fileDownloadCollection = db.collection("file_download_details");

    const fileDownloadProcessMinutes =
        +envVars.FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES;

    const fileDownloadProcessDateTime = DateTime.local().minus({
        minutes: fileDownloadProcessMinutes
    });
    const queryDoc = {
        status: "submitted",
        created_time: { $lte: fileDownloadProcessDateTime }
    };

    const submittedDownloadList = await fileDownloadCollection
        .find(queryDoc)
        .toArray();

    await client.close();

    if (submittedDownloadList.length === 0) {
        closeOpenAlert(CartaAlerts.File_Download_Processing_Delay);

        return {
            statusCode: 200,
            body: JSON.stringify("Success"),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }

    const listNames = submittedDownloadList.map(
        (download) =>
            `list: ${download.list_name} user: ${download.user.user_name}`
    );

    await createAlert(
        CartaAlerts.File_Download_Processing_Delay,
        generateProcessingMessage(listNames)
    );

    return {
        statusCode: 200,
        body: JSON.stringify("Success"),
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        }
    };
};

const handler = middy(baseCheckFileDownloadProcessing).use(
    errorHandlerMiddleware()
);

export { handler as checkFileDownloadProcessing };
