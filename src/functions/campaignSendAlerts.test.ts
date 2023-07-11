import { DateTime } from "luxon";
import {
    NewsletterSend,
    SendState,
    baseCampaignSendAlerts,
    evaluateNewsletterSend
} from "./campaignSendAlerts";
import { Collection, Db, MongoClient, ObjectId } from "mongodb";
import { getMongoDatabase } from "../mongo";
import { MongoMemoryServer } from "mongodb-memory-server";
import { closeOpenAlert, createAlert, escalateAlert } from "../opsGenie";
import { envVars } from "../environmentVariables";

jest.mock("../opsGenie", () => ({
    closeOpenAlert: jest.fn(),
    createAlert: jest.fn(),
    escalateAlert: jest.fn()
}));

jest.mock("../environmentVariables", () => ({
    envVars: {
        SENDS_PER_ALLOWED_TIME_SEGMENT: 1000000,
        MINUTES_PER_ALLOWED_TIME_SEGMENT: 30,
        SUCCESSFUL_SEND_COMPLETION_PERCENTAGE: 0.9
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

const id1 = new ObjectId();
const id2 = new ObjectId();

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

const createSend = (overrides: Partial<NewsletterSend> = {}) => {
    const now = DateTime.now();
    const baseSend: NewsletterSend = {
        _id: new ObjectId(),
        letterId: "someLetterId",
        metricsSentEmails: 900000,
        metricsSentEmailsErr: 100000,
        scheduledSendTime: now.toISO(),
        statusWaitTimestamp: now.minus({ minutes: 1 }).toMillis(),
        totalSendSize: 101,
        statusDoneTimestamp: now.toJSDate()
    };

    return { ...baseSend, ...overrides };
};

const checkState = (sendData: NewsletterSend, expectedState: SendState) => {
    const result = evaluateNewsletterSend(sendData);
    expect(result).toEqual({ state: expectedState, id: sendData._id });
};

describe("evaluateNewsletterSend", () => {
    describe('Tests for "done" state', () => {
        test("send percentage is equal to the successful send completion percentage", () => {
            const send = createSend();
            checkState(send, "done");
        });

        test("send percentage is greater than the successful send completion percentage", () => {
            const send = createSend({
                metricsSentEmails: 1000000,
                metricsSentEmailsErr: 100000
            });
            checkState(send, "done");
        });

        test("send percentage is equal to the successful send completion percentage with large segmentCount", () => {
            const send = createSend({
                metricsSentEmails: 1800000,
                metricsSentEmailsErr: 200000
            });
            checkState(send, "done");
        });

        test("send percentage is equal to the successful send completion percentage with even larger segmentCount", () => {
            const send = createSend({
                metricsSentEmails: 2700000,
                metricsSentEmailsErr: 300000
            });
            checkState(send, "done");
        });
    });

    describe('Tests for "warning" state', () => {
        test("send incomplete and minutes since scheduled send is greater than the allotted minutes for a P1 alert", () => {
            const send = createSend({
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: DateTime.now().minus({ minutes: 31 }).toISO()
            });
            checkState(send, "warning");
        });

        test("send incomplete and minutes since scheduled send is greater than the alloted minutes for a P1 alert with large segmentCount", () => {
            const send = createSend({
                metricsSentEmails: 1799998,
                metricsSentEmailsErr: 200000,
                scheduledSendTime: DateTime.now().minus({ minutes: 61 }).toISO()
            });
            checkState(send, "warning");
        });

        test("send incomplete and minutes since scheduled send is greater than the alloted minutes for a P1 alert with even larger segmentCount", () => {
            const send = createSend({
                metricsSentEmails: 2699997,
                metricsSentEmailsErr: 300000,
                scheduledSendTime: DateTime.now().minus({ minutes: 91 }).toISO()
            });
            checkState(send, "warning");
        });

        test("should create multiple warning alerts when there are multiple eligible newsletters", () => {
            const send1 = createSend({
                _id: id1,
                letterId: "newsletter1",
                metricsSentEmails: 500000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: DateTime.now().minus({ minutes: 35 }).toISO()
            });
            const send2 = createSend({
                _id: id2,
                letterId: "newsletter2",
                metricsSentEmails: 700000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: DateTime.now().minus({ minutes: 40 }).toISO()
            });
            const newsletterSends = [send1, send2];

            const results = newsletterSends.map((send) =>
                evaluateNewsletterSend(send)
            );
            const warningAlertIds = results
                .filter((result) => result && result.state === "warning")
                .map((result) => result.id);

            expect(warningAlertIds).toEqual([id1, id2]);
        });
    });

    describe('Tests for "alarm" state', () => {
        test("should return state as 'alarm' when minutes since scheduled send is greater than the allotted minutes for a P0 alert", () => {
            const send = createSend({
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: DateTime.now().minus({ minutes: 91 }).toISO()
            });
            checkState(send, "alarm");
        });

        test("should return state as 'alarm' when minutes since scheduled send is greater than the alloted minutes for a P0 alert with large segmentCount", () => {
            const send = createSend({
                metricsSentEmails: 1799998,
                metricsSentEmailsErr: 200000,
                scheduledSendTime: DateTime.now()
                    .minus({ minutes: 121 })
                    .toISO()
            });
            checkState(send, "alarm");
        });

        test("should return state as 'alarm' when minutes since scheduled send is greater than the alloted minutes for a P0 alert with even larger segmentCount", () => {
            const send = createSend({
                metricsSentEmails: 2699997,
                metricsSentEmailsErr: 300000,
                scheduledSendTime: DateTime.now()
                    .minus({ minutes: 151 })
                    .toISO()
            });

            checkState(send, "alarm");
        });
    });

    describe("Tests for no newsletter states set", () => {
        test("should return null if no sends have been attempted", () => {
            const send = createSend({
                metricsSentEmails: 0,
                metricsSentEmailsErr: 0
            });
            const result = evaluateNewsletterSend(send);
            expect(result).toBeNull();
        });

        test("should return null if send is before alloted minutes time", () => {
            const send = createSend({
                metricsSentEmails: 1799998,
                metricsSentEmailsErr: 200000,
                scheduledSendTime: DateTime.now().minus({ minutes: 29 }).toISO()
            });
            const result = evaluateNewsletterSend(send);
            expect(result).toBeNull();
        });
    });
});

describe("Call alerts", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nlSendCollection: Collection<any>;

    beforeEach(async () => {
        nlSendCollection = db.collection("nlSend");
    });

    it("should call closeAlert if there are <2 warning sends", async () => {
        await nlSendCollection.insertMany([
            createSend({
                _id: id1,
                metricsSentEmails: 1000000,
                metricsSentEmailsErr: 100000
            }),
            createSend({
                _id: id2,
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            })
        ]);

        await baseCampaignSendAlerts();
        expect(closeOpenAlert).toHaveBeenCalled();

        const sends = await nlSendCollection.find().toArray();
        const sendStates = sends.map((send) => send.sendState);
        expect(sendStates.includes("done")).toBeTruthy();
        expect(sendStates.includes("warning")).toBeTruthy();
    });

    it("should call createAlert if there are 2 warning sends", async () => {
        await nlSendCollection.insertMany([
            createSend({
                _id: id1,
                metricsSentEmails: 70000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            }),
            createSend({
                _id: id2,
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            })
        ]);

        await baseCampaignSendAlerts();
        expect(createAlert).toHaveBeenCalled();

        const sends = await nlSendCollection.find().toArray();
        const sendStates = sends.map((send) => send.sendState);
        expect(sendStates.includes("done")).toBeFalsy();
        expect(sendStates.includes("warning")).toBeTruthy();
    });

    it("should call escalateAlert if there is an alarm send", async () => {
        await nlSendCollection.insertMany([
            createSend({
                _id: id1,
                metricsSentEmails: 70000,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 30 }).toISO()
            }),
            createSend({
                _id: id2,
                metricsSentEmails: 899999,
                metricsSentEmailsErr: 100000,
                scheduledSendTime: now.minus({ minutes: 121 }).toISO() // cause alarm
            })
        ]);

        await baseCampaignSendAlerts();
        expect(escalateAlert).toHaveBeenCalled();

        const sends = await nlSendCollection.find().toArray();
        const sendStates = sends.map((send) => send.sendState);
        expect(sendStates.includes("alarm")).toBeTruthy();
    });
});
