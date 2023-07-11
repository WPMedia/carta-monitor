import { DateTime, Settings } from "luxon";
import {
    baseCheckDynamicListProcessing,
    getMostRecentQuarterHour
} from "./dynamicListProcessing";
import { MongoMemoryServer } from "mongodb-memory-server";
import { getMongoDatabase } from "../mongo";
import { createAlert } from "../opsGenie";
import { Collection, Db, Document, MongoClient } from "mongodb";
import { CartaAlerts } from "../alerts";
import { envVars } from "../environmentVariables";

jest.mock("../opsGenie", () => ({
    createAlert: jest.fn(),
    closeOpenAlert: jest.fn()
}));

jest.mock("../environmentVariables", () => ({
    envVars: {}
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

const testingDateTime = DateTime.local(2023, 5, 30, 0, 0, 0);

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    envVars.MONGODB_URI = uri;

    const connection = await getMongoDatabase();
    db = connection.db;
    client = connection.client;

    Settings.now = () => testingDateTime.toMillis();
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

const expectDateTimeToEqual = (dateTime: DateTime, expected: DateTime) => {
    expect(dateTime.year).toBe(expected.year);
    expect(dateTime.month).toBe(expected.month);
    expect(dateTime.day).toBe(expected.day);
    expect(dateTime.hour).toBe(expected.hour);
    expect(dateTime.minute).toBe(expected.minute);
    expect(dateTime.second).toBe(expected.second);
    expect(dateTime.millisecond).toBe(expected.millisecond);
};

describe("getMostRecentQuarterHour", () => {
    const topOfHourTime = DateTime.fromISO("2023-05-31T10:59:59.999");
    const quarterHourTime = DateTime.fromISO("2023-05-31T10:14:59.999");
    const exactQuarterHourTime = DateTime.fromISO("2023-05-31T10:15:00.000");

    it("returns the most recent quarter hour near the top of the hour", () => {
        const mostRecentQuarterHour = getMostRecentQuarterHour(topOfHourTime);
        expectDateTimeToEqual(
            mostRecentQuarterHour,
            DateTime.fromISO("2023-05-31T10:45:00.000")
        );
    });

    it("returns the most recent quarter hour near the quarter hour", () => {
        const mostRecentQuarterHour = getMostRecentQuarterHour(quarterHourTime);
        expectDateTimeToEqual(
            mostRecentQuarterHour,
            DateTime.fromISO("2023-05-31T10:00:00.000")
        );
    });

    it("returns the most recent quarter hour exactly on the quarter hour", () => {
        const mostRecentQuarterHour =
            getMostRecentQuarterHour(exactQuarterHourTime);
        expectDateTimeToEqual(
            mostRecentQuarterHour,
            DateTime.fromISO("2023-05-31T10:15:00.000")
        );
    });
});

describe("checkDynamicListProcessing", () => {
    let createAlertMock: jest.Mock;
    let lmListsCollection: Collection<Document>;

    beforeEach(() => {
        createAlertMock = createAlert as jest.Mock;
        createAlertMock.mockClear();
        lmListsCollection = db.collection("lm_lists");
    });

    afterEach(async () => {
        await lmListsCollection.deleteMany({});
    });

    it("does not create alerts when lists are processing", async () => {
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

        await baseCheckDynamicListProcessing();

        const processedLists = await lmListsCollection.countDocuments();
        expect(processedLists).toBe(2);
        expect(createAlert).not.toHaveBeenCalled();
    });

    it("creates an alert when an auto-run list is not processing", async () => {
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

        await baseCheckDynamicListProcessing();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.Automatic_Dynamic_List,
            expect.stringContaining("Sample autorun list")
        );
        expect(createAlert).not.toHaveBeenCalledWith(
            CartaAlerts.Scheduled_Dynamic_List,
            expect.any(String)
        );
    });

    it("creates an alert when a scheduled list is not processing", async () => {
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

        await baseCheckDynamicListProcessing();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.Scheduled_Dynamic_List,
            expect.stringContaining("Sample scheduled list")
        );
        expect(createAlert).not.toHaveBeenCalledWith(
            CartaAlerts.Automatic_Dynamic_List,
            expect.any(String)
        );
    });
});
