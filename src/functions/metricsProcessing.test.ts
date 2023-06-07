import { CartaAlerts } from "../alerts";
import { closeOpenAlert, createAlert } from "../opsGenieHelpers";
import { checkMetricsProcessing } from "./metricsProcessing";

process.env.MONGODB_URI = "mongodb://localhost:27017/{0}";
process.env.MONGODB_NAME = "testDB";

jest.mock("../helpers", () => ({
    getParametersFromSSM: jest.fn().mockReturnValue([{ value: "mockPassword" }])
}));

jest.mock("../opsGenieHelpers", () => ({
    closeOpenAlert: jest.fn(),
    createAlert: jest.fn(),
    CartaAlerts: {
        Metrics_Processing_Above_Threshshold: "mockAlert"
    }
}));

const mockConnect = jest.fn();
const mockClose = jest.fn();
const mockDb = jest.fn();
const mockCollection = jest.fn();
const mockEstimatedDocumentCount = jest.fn();

jest.mock("mongodb", () => {
    return {
        MongoClient: jest.fn().mockImplementation(() => {
            return {
                connect: mockConnect,
                close: mockClose,
                db: mockDb
            };
        }),
        Db: jest.fn().mockImplementation(() => {
            return {
                collection: mockCollection
            };
        })
    };
});

describe("checkMetricsProcessing", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        mockDb.mockReturnValue({
            collection: mockCollection
        });

        mockCollection.mockReturnValue({
            estimatedDocumentCount: mockEstimatedDocumentCount
        });

        mockConnect.mockResolvedValue(undefined);
        mockClose.mockResolvedValue(undefined);
    });

    test("calls createAlert when estimatedDocumentCount is above the threshold", async () => {
        mockEstimatedDocumentCount.mockResolvedValue(20000001); // Above threshold

        await checkMetricsProcessing();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.Metrics_Processing_Above_Threshshold
        );
        expect(closeOpenAlert).not.toHaveBeenCalled();
    });

    test("calls closeAlert when estimatedDocumentCount is below the threshold", async () => {
        mockEstimatedDocumentCount.mockResolvedValue(19999999); // Below threshold

        await checkMetricsProcessing();

        expect(closeOpenAlert).toHaveBeenCalledWith(
            CartaAlerts.Metrics_Processing_Above_Threshshold
        );
        expect(createAlert).not.toHaveBeenCalled();
    });
});
