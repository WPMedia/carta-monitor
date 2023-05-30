import { Db, MongoClient } from "mongodb";
import { getParametersFromSSM } from "./helpers";

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
        console.log(`Connected successfully to ${process.env.MONGODB_NAME}`);
        return { db: client.db(process.env.MONGODB_NAME), client };
    } catch (error) {
        console.error(
            `An error occurred while connecting to MongoDB: ${error}`
        );
        // Rethrow the error to be caught in the function calling getMongoDatabase
        throw error;
    }
};
