import { CartaAlerts } from "../alerts";
import { getMongoDatabase } from "../mongo";
import { closeOpenAlert, createAlert } from "../opsGenieHelpers";

export const checkFileDownloadProcessing = async () => {
    const { db, client } = await getMongoDatabase();
    const fileDownloadCollection = db.collection("file_download_details");

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const queryDoc = {
        status: "submitted",
        created_time: { $lte: fifteenMinutesAgo }
    };

    const submittedDownloadList = await fileDownloadCollection
        .find(queryDoc)
        .toArray();

    if (submittedDownloadList.length === 0) {
        closeOpenAlert(CartaAlerts.File_Download_Processing_Delay);

        // If the function is running in a local environment (as specified by the IS_LOCAL environment variable),
        // we close the MongoDB client connection after the function execution is complete. This is done because
        // in a local environment (like when running tests or invoking the function manually), Node.js process
        // won't exit as long as there are open connections. However, in a production environment (e.g., on AWS Lambda),
        // connections are managed differently, so we want to keep them open for possible reuse across multiple
        // invocations of the function for performance reasons.
        if (process.env.IS_LOCAL) {
            await client.close();
        }

        return {
            statusCode: 200,
            body: JSON.stringify("Success"),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        };
    }

    const listNames = submittedDownloadList.map((download) => {
        const user = download.user;
        return `list: ${download.list_name} user: ${user.user_name}`;
    });

    await createAlert(
        CartaAlerts.File_Download_Processing_Delay,
        `${
            submittedDownloadList.length
        } file(s) currently processing: ${listNames.join(", ")}`
    );
};
