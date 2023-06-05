import { DateTime } from "luxon";
import {
    NewsletterSend,
    SendState,
    campaignSendAlerts,
    evaluateNewsletterSend,
    updateSendState
} from "./campaignSendAlerts";
import { Collection, Db, MongoClient, ObjectId } from "mongodb";
import { getMongoDatabase } from "../mongo";
import { MongoMemoryServer } from "mongodb-memory-server";
import { closeOpenAlert, createAlert, escalateAlert } from "../opsGenieHelpers";

jest.mock("../opsGenieHelpers", () => ({
    closeOpenAlert: jest.fn(),
    createAlert: jest.fn(),
    escalateAlert: jest.fn()
}));

jest.mock("../helpers", () => ({
    getParametersFromSSM: jest.fn().mockReturnValue([
        {
            "mongodb.password": "testpassword"
        }
    ])
}));

let mongo: MongoMemoryServer;
let db: Db;
let client: MongoClient;

const id1 = new ObjectId();
const id2 = new ObjectId();

beforeEach(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_NAME = "test-db";

    const connection = await getMongoDatabase();
    db = connection.db;
    client = connection.client;
});

afterEach(async () => {
    await db.collection("nlSend").deleteMany({});
    await client.close();
    await mongo.stop();
});

const now = DateTime.now();
const someObjectId = new ObjectId();
const defaultSend = {
    _id: someObjectId,
    letterId: "someLetterId",
    metricsSentEmails: 900000,
    metricsSentEmailsErr: 100000,
    scheduledSendTime: now.toISO(),
    statusWaitTimestamp: now.minus({ minutes: 1 }).toMillis(),
    totalSendSize: 101
} as NewsletterSend;

describe("evaluateNewsletterSend", () => {
    test("should return null if no sends have been attempted", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 0,
            metricsSentEmailsErr: 0
        });

        expect(result).toBeNull();
    });

    test("should return state as 'done' when send percentage is equal to the successful send completion percentage", () => {
        const result = evaluateNewsletterSend(defaultSend);

        expect(result).toEqual({ state: "done", id: someObjectId });
    });

    test("should return state as 'done' when send percentage is greater than the successful send completion percentage", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 1000000,
            metricsSentEmailsErr: 100000
        });

        expect(result).toEqual({ state: "done", id: someObjectId });
    });

    test("should return state as 'warning' when send incomplete and minutes since scheduled send is greater than the alloted minutes for a P1 alert", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 899999,
            metricsSentEmailsErr: 100000,
            scheduledSendTime: now.minus({ minutes: 31 }).toISO()
        });

        expect(result).toEqual({ state: "warning", id: someObjectId });
    });

    test("should return state as 'warning' when send incomplete and minutes since scheduled send is equal to the alloted minutes for a P1 alert", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 899999,
            metricsSentEmailsErr: 100000,
            scheduledSendTime: now.minus({ minutes: 30 }).toISO()
        });

        expect(result).toEqual({ state: "warning", id: someObjectId });
    });

    test("should return state as 'alarm' when minutes since scheduled send is greater than the alloted minutes for a P0 alert", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 899999,
            metricsSentEmailsErr: 100000,
            scheduledSendTime: now.minus({ minutes: 91 }).toISO()
        });

        expect(result).toEqual({
            state: "alarm",
            id: someObjectId
        });
    });

    test("should return state as 'alarm' when minutes since scheduled send is equal to the alloted minutes for a P0 alert", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 899999,
            metricsSentEmailsErr: 100000,
            scheduledSendTime: now.minus({ minutes: 90 }).toISO()
        });

        expect(result).toEqual({ state: "alarm", id: someObjectId });
    });

    test("should create multiple warning alerts when there are multiple eligible newsletters", () => {
        const newsletterSends = [
            {
                _id: id1,
                letterId: "newsletter1",
                metricsSentEmails: 500000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 35 }).toISO()
            } as NewsletterSend,
            {
                _id: id2,
                letterId: "newsletter2",
                metricsSentEmails: 700000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 40 }).toISO()
            } as NewsletterSend
        ];

        const results = newsletterSends.map((newsletterSend) =>
            evaluateNewsletterSend(newsletterSend)
        );

        const warningAlertIds = results
            .filter((result) => result && result.state === "warning")
            .map((result) => result.id);

        expect(warningAlertIds).toEqual([id1, id2]);
    });

    test("should return state as 'done' when send percentage is equal to the successful send completion percentage with large segmentCount", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 1800000,
            metricsSentEmailsErr: 200000
        });

        expect(result).toEqual({ state: "done", id: someObjectId });
    });

    test("should return state as 'warning' when send incomplete and minutes since scheduled send is greater than the alloted minutes for a P1 alert with large segmentCount", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 1799998,
            metricsSentEmailsErr: 200000,
            scheduledSendTime: now.minus({ minutes: 61 }).toISO()
        });

        expect(result).toEqual({ state: "warning", id: someObjectId });
    });

    test("should return state as 'alarm' when minutes since scheduled send is greater than the alloted minutes for a P0 alert with large segmentCount", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 1799998,
            metricsSentEmailsErr: 200000,
            scheduledSendTime: now.minus({ minutes: 121 }).toISO()
        });

        expect(result).toEqual({ state: "alarm", id: someObjectId });
    });

    test("should return state as 'done' when send percentage is equal to the successful send completion percentage with even larger segmentCount", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 2700000,
            metricsSentEmailsErr: 300000
        });

        expect(result).toEqual({ state: "done", id: someObjectId });
    });

    test("should return state as 'warning' when send incomplete and minutes since scheduled send is greater than the alloted minutes for a P1 alert with even larger segmentCount", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 2699997,
            metricsSentEmailsErr: 300000,
            scheduledSendTime: now.minus({ minutes: 91 }).toISO()
        });

        expect(result).toEqual({ state: "warning", id: someObjectId });
    });

    test("should return state as 'alarm' when minutes since scheduled send is greater than the alloted minutes for a P0 alert with even larger segmentCount", () => {
        const result = evaluateNewsletterSend({
            ...defaultSend,
            metricsSentEmails: 2699997,
            metricsSentEmailsErr: 300000,
            scheduledSendTime: now.minus({ minutes: 151 }).toISO()
        });

        expect(result).toEqual({ state: "alarm", id: someObjectId });
    });
});

describe("Update newsletter send state", () => {
    let nlSendCollection: Collection<any>;

    beforeEach(async () => {
        nlSendCollection = db.collection("nlSend");
    });

    it("should set sendState to done", async () => {
        const doneIds = [new ObjectId(), new ObjectId(), new ObjectId()];
        await nlSendCollection.insertOne({ defaultSend });
        await updateSendState(nlSendCollection, doneIds, "done");

        const docs = await nlSendCollection
            .find({ _id: { $in: doneIds.map((id) => new ObjectId(id)) } })
            .toArray();
        docs.forEach((doc) => expect(doc.sendState).toBe("done"));
    });

    it("should set sendState to warning", async () => {
        const warningIds = [new ObjectId(), new ObjectId(), new ObjectId()];
        await nlSendCollection.insertMany(
            warningIds.map((id) => ({
                _id: new ObjectId(id),
                sendState: "" as SendState
            }))
        );
        await updateSendState(nlSendCollection, warningIds, "warning");

        const docs = await nlSendCollection
            .find({ _id: { $in: warningIds.map((id) => new ObjectId(id)) } })
            .toArray();
        docs.forEach((doc) => expect(doc.sendState).toBe("warning"));
    });

    it("should set sendState to alarm", async () => {
        const alarmIds = [new ObjectId(), new ObjectId(), new ObjectId()];
        await nlSendCollection.insertMany(
            alarmIds.map((id) => ({
                _id: new ObjectId(id),
                sendState: "" as SendState
            }))
        );
        await updateSendState(nlSendCollection, alarmIds, "alarm");

        const docs = await nlSendCollection
            .find({ _id: { $in: alarmIds.map((id) => new ObjectId(id)) } })
            .toArray();
        docs.forEach((doc) => expect(doc.sendState).toBe("alarm"));
    });
});

describe("Call alerts", () => {
    let nlSendCollection: Collection<any>;

    beforeEach(async () => {
        nlSendCollection = db.collection("nlSend");
    });

    it("should call closeAlert if there are <2 warning sends", async () => {
        await nlSendCollection.insertMany([
            {
                ...defaultSend,
                _id: id1,
                metricsSentEmails: 1000000,
                metricsSentEmailsErr: 100000
            },
            {
                ...defaultSend,
                _id: id2,
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            }
        ]);
        await campaignSendAlerts();
        expect(closeOpenAlert).toHaveBeenCalled();

        const sends = await nlSendCollection.find().toArray();
        const sendStates = sends.map((send) => send.sendState);
        expect(sendStates.includes("done")).toBeTruthy();
        expect(sendStates.includes("warning")).toBeTruthy();
    });

    it("should call createAlert if there are 2 warning sends", async () => {
        await nlSendCollection.insertMany([
            {
                ...defaultSend,
                _id: id1,
                metricsSentEmails: 70000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            },
            {
                ...defaultSend,
                _id: id2,
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            }
        ]);
        await campaignSendAlerts();
        expect(createAlert).toHaveBeenCalled();

        const sends = await nlSendCollection.find().toArray();
        const sendStates = sends.map((send) => send.sendState);
        expect(sendStates.includes("done")).toBeFalsy();
        expect(sendStates.includes("warning")).toBeTruthy();
    });

    it("should call escalateAlert if there is an alarm send", async () => {
        await nlSendCollection.insertMany([
            {
                ...defaultSend,
                _id: id1,
                metricsSentEmails: 70000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            },
            {
                ...defaultSend,
                _id: id2,
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 121 }).toISO() // cause alarm
            }
        ]);
        await campaignSendAlerts();
        expect(escalateAlert).toHaveBeenCalled();

        const sends = await nlSendCollection.find().toArray();
        const sendStates = sends.map((send) => send.sendState);
        expect(sendStates.includes("alarm")).toBeTruthy();
    });
});
