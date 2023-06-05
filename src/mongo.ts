import { Collection, Db, MongoClient } from "mongodb";
import { getParametersFromSSM } from "./helpers";
import { NewsletterSend } from "./functions/campaignSendAlerts";

export const getMongoDatabase = async (): Promise<{
    db: Db;
    client: MongoClient;
}> => {
    const mongoConnectionStringPassword = (
        await getParametersFromSSM(["mongodb.password"])
    )[0].value;
    const mongoUri = process.env.MONGODB_URI.replace(
        "{0}",
        mongoConnectionStringPassword
    );

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        return { db: client.db(process.env.MONGODB_NAME), client };
    } catch (error) {
        console.error(
            `An error occurred while connecting to MongoDB: ${error}`
        );
        // Rethrow the error to be caught in the function calling getMongoDatabase
        throw error;
    }
};

export type Send =
    | "personalized"
    | "nonpersonalized"
    | "transactional"
    | "alert";

export const sendFilters: Record<
    Send,
    { queueTag: number; personalize?: boolean }
> = {
    personalized: { queueTag: 1000, personalize: true },
    nonpersonalized: { queueTag: 1000, personalize: false },
    transactional: { queueTag: 10000 },
    alert: { queueTag: 50000 }
};

export const findMostRecentSend = async (
    nlSendCollection: Collection<NewsletterSend>,
    sendType: Send
) => {
    const filter = sendFilters[sendType];

    // Query for the entry with queueTag:50000, personalized: true and the most recent statusDoneTimestamp
    const entry = await nlSendCollection
        .find(filter)
        .sort({ statusDoneTimestamp: -1 }) // Sort by statusDoneTimestamp in descending order
        .limit(1) // Limit to the first (most recent) result
        .toArray(); // Convert to array to retrieve the documents

    if (entry.length === 0) {
        return null;
    }

    return entry[0];
};
