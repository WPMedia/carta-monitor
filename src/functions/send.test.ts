import { DateTime } from "luxon";
import { NewsletterSend } from "./campaignSendAlerts";
import { Collection, Db, MongoClient, ObjectId } from "mongodb";
import { getMongoDatabase, sendFilters } from "../mongo";
import { MongoMemoryServer } from "mongodb-memory-server";
import { closeOpenAlert, createAlert, escalateAlert } from "../opsGenie";
import { baseSend } from "./send";
import { CartaAlerts, Priority } from "../alerts";
import { envVars } from "../environmentVariables";

jest.mock("../opsGenie", () => ({
    closeOpenAlert: jest.fn(),
    createAlert: jest.fn(),
    escalateAlert: jest.fn()
}));

jest.mock("../environmentVariables", () => ({
    envVars: {
        SEND_DELAY_P2_MINUTES: 15,
        SEND_DELAY_P1_MINUTES: 30
    }
}));

jest.mock("../ssm", () => ({
    getSsmCache: jest.fn().mockReturnValue([
        {
            "mongodb.password": "testpassword"
        }
    ])
}));

let mongo: MongoMemoryServer;
let db: Db;
let client: MongoClient;

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    envVars.MONGODB_URI = uri;
    const connection = await getMongoDatabase();
    db = connection.db;
    client = connection.client;
});

afterEach(async () => {
    await db.collection("nlSend").deleteMany({});
});

afterAll(async () => {
    const connection = await getMongoDatabase();
    await connection.client.close();
    await client.close();
    await mongo.stop();
});

const now = DateTime.now();
const id1 = new ObjectId("64aed37b4ccf20fdb119055e");
const id2 = new ObjectId("64aed38dc9c555764d4180b2");
const id3 = new ObjectId("64aed3067a891eb0f4438521");

const defaultSend = {
    _id: id1,
    letterId: "someLetterId",
    metricsSentEmails: 900000,
    metricsSentEmailsErr: 100000,
    scheduledSendTime: now.toJSDate(),
    statusWaitTimestamp: now.minus({ minutes: 1 }).toJSDate(),
    totalSendSize: 101
} as NewsletterSend;

describe("Checking that sends are occuring regularly", () => {
    let nlSendCollection: Collection<NewsletterSend>;

    beforeEach(async () => {
        nlSendCollection = db.collection<NewsletterSend>("nlSend");
    });

    test("should call close alert when none", async () => {
        const recentSend = {
            ...defaultSend,
            statusDoneTimestamp: now.minus({ minutes: 14 }).toJSDate(),
            ...sendFilters["transactional"]
        };
        await nlSendCollection.insertOne(recentSend);

        await baseSend();

        expect(closeOpenAlert).toHaveBeenCalledWith(
            CartaAlerts.Transactional_Send_Delay
        );
    });

    test("should create alert 15 minutes send alert", async () => {
        const oldSend = {
            ...defaultSend,
            statusDoneTimestamp: now.minus({ minutes: 16 }).toJSDate(),
            ...sendFilters["alert"]
        };
        await nlSendCollection.insertOne(oldSend);

        await baseSend();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.Alert_Send_Delay,
            expect.any(String)
        );
    });

    test("should escalated personalized send after 30 minutes", async () => {
        const oldSend = {
            ...defaultSend,
            statusDoneTimestamp: now.minus({ minutes: 31 }).toJSDate(),
            ...sendFilters["personalized"]
        };
        await nlSendCollection.insertOne(oldSend);

        await baseSend();

        expect(escalateAlert).toHaveBeenCalledWith(
            CartaAlerts.Personalized_Send_Delay,
            Priority.P1
        );
    });

    test("should create multiple alerts", async () => {
        const oldPersonalizedSend = {
            ...defaultSend,
            statusDoneTimestamp: now.minus({ minutes: 31 }).toJSDate(),
            ...sendFilters["personalized"]
        };

        const oldNonpersonalizedSend = {
            ...defaultSend,
            _id: id2,
            statusDoneTimestamp: now.minus({ minutes: 16 }).toJSDate(),
            ...sendFilters["nonpersonalized"]
        };

        const recentAlertSend = {
            ...defaultSend,
            _id: id3,
            statusDoneTimestamp: now.minus({ minutes: 12 }).toJSDate(),
            ...sendFilters["alert"]
        };

        await nlSendCollection.insertMany([
            oldPersonalizedSend,
            oldNonpersonalizedSend,
            recentAlertSend
        ]);

        await baseSend();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.Personalized_Send_Delay,
            expect.any(String)
        );
        expect(escalateAlert).toHaveBeenCalledWith(
            CartaAlerts.Personalized_Send_Delay,
            Priority.P1
        );

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.NonPersonalized_Send_Delay,
            expect.any(String)
        );

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.Alert_Send_Delay,
            expect.any(String)
        );
        expect(closeOpenAlert).toHaveBeenCalledWith(
            CartaAlerts.Alert_Send_Delay
        );
    });
});
