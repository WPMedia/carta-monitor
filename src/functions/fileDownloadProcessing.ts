import { getMongoDatabase } from "../mongo";
import { CartaAlerts, closeOpenAlert, createAlert } from "../opsGenieHelpers";

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
        await client.close();
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

    createAlert(
        CartaAlerts.File_Download_Processing_Delay,
        `${
            submittedDownloadList.length
        } file(s) currently processing: ${listNames.join(", ")}`
    );
    await client.close();
};
