import { DateTime, Settings } from "luxon";
import {
    checkDynamicListProcessing,
    getMostRecentQuarterHour
} from "./dynamicListProcessing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getMongoDatabase } from "../mongo";
import { CartaAlerts, createAlert } from "../opsGenieHelpers";

jest.mock("../opsGenieHelpers", () => ({
    createAlert: jest.fn()
}));

let mongo: MongoMemoryServer;

const testingDateTime = DateTime.local(2023, 5, 30, 0, 0, 0);

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_NAME = "test-db";

    Settings.now = () => testingDateTime.toMillis();
});

afterAll(async () => {
    await mongo.stop();
});

describe("getMostRecentQuarterHour", () => {
    it("handles edge cases near the top of the hour", () => {
        const time = DateTime.fromISO("2023-05-31T10:59:59.999");
        const mostRecentQuarterHour = getMostRecentQuarterHour(time);

        expect(mostRecentQuarterHour.year).toBe(2023);
        expect(mostRecentQuarterHour.month).toBe(5);
        expect(mostRecentQuarterHour.day).toBe(31);
        expect(mostRecentQuarterHour.hour).toBe(10);
        expect(mostRecentQuarterHour.minute).toBe(45);
        expect(mostRecentQuarterHour.second).toBe(0);
        expect(mostRecentQuarterHour.millisecond).toBe(0);
    });

    it("handles edge cases near the quarter hour", () => {
        const time = DateTime.fromISO("2023-05-31T10:14:59.999");
        const mostRecentQuarterHour = getMostRecentQuarterHour(time);

        expect(mostRecentQuarterHour.year).toBe(2023);
        expect(mostRecentQuarterHour.month).toBe(5);
        expect(mostRecentQuarterHour.day).toBe(31);
        expect(mostRecentQuarterHour.hour).toBe(10);
        expect(mostRecentQuarterHour.minute).toBe(0);
        expect(mostRecentQuarterHour.second).toBe(0);
        expect(mostRecentQuarterHour.millisecond).toBe(0);
    });

    it("handles edge cases exactly on the quarter hour", () => {
        const time = DateTime.fromISO("2023-05-31T10:15:00.000");
        const mostRecentQuarterHour = getMostRecentQuarterHour(time);

        expect(mostRecentQuarterHour.year).toBe(2023);
        expect(mostRecentQuarterHour.month).toBe(5);
        expect(mostRecentQuarterHour.day).toBe(31);
        expect(mostRecentQuarterHour.hour).toBe(10);
        expect(mostRecentQuarterHour.minute).toBe(15);
        expect(mostRecentQuarterHour.second).toBe(0);
        expect(mostRecentQuarterHour.millisecond).toBe(0);
    });
});

describe("checkDynamicListProcessing", () => {
    let createAlertMock: jest.Mock;

    beforeEach(() => {
        createAlertMock = createAlert as jest.Mock;
        createAlertMock.mockClear();
    });

    afterEach(async () => {
        const { db, client } = await getMongoDatabase();
        const lmListsCollection = db.collection("lm_lists");
        await lmListsCollection.deleteMany({});
        client.close();
    });

    it("should not create alerts when lists are processing", async () => {
        const { db, client } = await getMongoDatabase();

        try {
            const lmListsCollection = db.collection("lm_lists");
            await lmListsCollection.deleteMany({});
            await lmListsCollection.insertMany([
                {
                    type: "DYNAMIC",
                    enabled: true,
                    autorun: true,
                    message: "Sample dynamic list 1",
                    updated_time: "2023-05-28T10:30:00.000Z",
                    autorun_time: null
                },
                {
                    type: "DYNAMIC",
                    enabled: true,
                    autorun: true,
                    message: "Sample dynamic list 2",
                    updated_time: "2023-05-28T10:45:00.000Z",
                    autorun_time: "1000"
                }
            ]);

            await checkDynamicListProcessing();

            // Check if the lists were added correctly
            const processedLists = await lmListsCollection.countDocuments();
            expect(processedLists).toBe(2);

            expect(createAlert).not.toHaveBeenCalled();
        } finally {
            await client.close();
        }
    });

    it("should create an alert when an auto-run list is not processing", async () => {
        const { db, client } = await getMongoDatabase();

        try {
            const lmListsCollection = db.collection("lm_lists");
            await lmListsCollection.deleteMany({});

            const triggerWindow = testingDateTime
                .minus({ hours: 25, minutes: 31 })
                .toISO();
            await lmListsCollection.insertOne({
                name: "Sample autorun list",
                type: "DYNAMIC",
                enabled: true,
                autorun: true,
                updated_time: triggerWindow,
                autorun_time: ""
            });

            await checkDynamicListProcessing();

            expect(createAlert).toHaveBeenCalledWith(
                CartaAlerts.Automatic_Dynamic_List,
                expect.stringContaining("Sample autorun list")
            );
            expect(createAlert).not.toHaveBeenCalledWith(
                CartaAlerts.Scheduled_Dynamic_List,
                expect.any(String)
            );
        } finally {
            await client.close();
        }
    });

    it("should create an alert when a scheduled list is not processing", async () => {
        const { db, client } = await getMongoDatabase();

        try {
            const lmListsCollection = db.collection("lm_lists");
            await lmListsCollection.deleteMany({});

            const triggerWindow = testingDateTime.minus({
                hours: 25,
                minutes: 31
            });
            await lmListsCollection.insertOne({
                name: "Sample scheduled list",
                type: "DYNAMIC",
                enabled: true,
                autorun: true,
                updated_time: triggerWindow.toISO(),
                autorun_time: triggerWindow.toFormat("HHmm")
            });

            await checkDynamicListProcessing();

            expect(createAlert).toHaveBeenCalledWith(
                CartaAlerts.Scheduled_Dynamic_List,
                expect.stringContaining("Sample scheduled list")
            );
            expect(createAlert).not.toHaveBeenCalledWith(
                CartaAlerts.Automatic_Dynamic_List,
                expect.any(String)
            );
        } finally {
            await client.close();
        }
    });
});
