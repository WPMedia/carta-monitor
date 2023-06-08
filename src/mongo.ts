import { Collection, Db, MongoClient } from "mongodb";
import { getEnvCache, getParametersFromSSM } from "./helpers";
import { NewsletterSend } from "./functions/campaignSendAlerts";

// In AWS Lambda, variables declared outside of the function handler, like cachedDb and cachedClient,
// are cached between function invocations for the lifetime of the container instance of the function.
// AWS reuses the function container for a period of time, before disposing it.
// During this period, these variables will maintain their values, making them effective for caching
// purposes like reusing a database connection. However, keep in mind that AWS can dispose of the function
// container at any time. So, we shouldn't rely on them for critical data or state.
// https://aws.amazon.com/blogs/compute/caching-data-and-configuration-settings-with-aws-lambda-extensions/

let cachedDb: Db;
let cachedClient: MongoClient;

export const getMongoDatabase = async (): Promise<{
    db: Db;
    client: MongoClient;
}> => {
    if (cachedDb && cachedClient) {
        console.log("Using cached database instance");
        return Promise.resolve({ db: cachedDb, client: cachedClient });
    }

    const mongoConnectionStringPassword = (
        await getParametersFromSSM(["mongodb.password"])
    )[0].value;
    const mongoUri = getEnvCache().MONGODB_URI.replace(
        "{0}",
        mongoConnectionStringPassword
    );

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        cachedDb = client.db(getEnvCache().MONGODB_NAME);
        cachedClient = client;
        return { db: cachedDb, client: cachedClient };
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
