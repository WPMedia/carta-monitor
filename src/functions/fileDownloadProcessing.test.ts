import { closeOpenAlert, createAlert } from "../opsGenie";
import { baseCheckFileDownloadProcessing } from "./fileDownloadProcessing";
import { getMongoDatabase } from "../mongo";
import { CartaAlerts } from "../alerts";

jest.mock("../opsGenie", () => ({
    closeOpenAlert: jest.fn(),
    createAlert: jest.fn(),
    CartaAlerts: {
        File_Download_Processing_Delay: "mockAlert"
    }
}));

jest.mock("../mongo", () => ({
    getMongoDatabase: jest.fn().mockResolvedValue({
        db: {
            collection: jest.fn().mockReturnValue({
                find: jest.fn().mockReturnThis(),
                toArray: jest.fn()
            })
        },
        client: {
            close: jest.fn()
        }
    })
}));

jest.mock("../environmentVariables", () => ({
    envVars: {
        FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES: 15
    }
}));

describe("checkFileDownloadProcessing", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("calls createAlert when files are currently processing", async () => {
        const mockToArray = jest.fn().mockResolvedValue([
            {
                list_name: "List 1",
                user: { user_name: "User 1" }
            },
            {
                list_name: "List 2",
                user: { user_name: "User 2" }
            }
        ]);

        const mockCollection = {
            find: jest.fn().mockReturnThis(),
            toArray: mockToArray
        };

        (getMongoDatabase as jest.Mock).mockResolvedValue({
            db: {
                collection: jest.fn().mockReturnValue(mockCollection)
            },
            client: {
                close: jest.fn()
            }
        });

        await baseCheckFileDownloadProcessing();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.File_Download_Processing_Delay,
            expect.stringContaining(
                "2 file(s) currently processing: list: List 1 user: User 1, list: List 2 user: User 2"
            )
        );
        expect(closeOpenAlert).not.toHaveBeenCalled();
        expect(mockCollection.find).toHaveBeenCalledWith({
            status: "submitted",
            created_time: {
                $lte: expect.anything()
            }
        });
        expect(mockToArray).toHaveBeenCalled();
    });

    test("calls closeAlert when no files are currently processing", async () => {
        const mockToArray = jest.fn().mockResolvedValue([]);

        const mockCollection = {
            find: jest.fn().mockReturnThis(),
            toArray: mockToArray
        };

        (getMongoDatabase as jest.Mock).mockResolvedValue({
            db: {
                collection: jest.fn().mockReturnValue(mockCollection)
            },
            client: {
                close: jest.fn()
            }
        });

        await baseCheckFileDownloadProcessing();

        expect(closeOpenAlert).toHaveBeenCalledWith(
            CartaAlerts.File_Download_Processing_Delay
        );
        expect(createAlert).not.toHaveBeenCalled();
        expect(mockCollection.find).toHaveBeenCalledWith({
            status: "submitted",
            created_time: {
                $lte: expect.anything()
            }
        });
        expect(mockToArray).toHaveBeenCalled();
    });
});
