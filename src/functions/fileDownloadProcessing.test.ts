import { CartaAlerts, closeOpenAlert, createAlert } from "../opsGenieHelpers";
import { checkFileDownloadProcessing } from "./fileDownloadProcessing";
import { getMongoDatabase } from "../mongo";

jest.mock("../opsGenieHelpers", () => ({
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

        const mockClientClose = jest.fn();

        (getMongoDatabase as jest.Mock).mockResolvedValue({
            db: {
                collection: jest.fn().mockReturnValue(mockCollection)
            },
            client: {
                close: mockClientClose
            }
        });

        await checkFileDownloadProcessing();

        expect(createAlert).toHaveBeenCalledWith(
            CartaAlerts.File_Download_Processing_Delay,
            "2 file(s) currently processing: list: List 1 user: User 1, list: List 2 user: User 2"
        );
        expect(closeOpenAlert).not.toHaveBeenCalled();
        expect(mockCollection.find).toHaveBeenCalledWith({
            status: "submitted",
            created_time: {
                $lte: expect.any(Date)
            }
        });
        expect(mockToArray).toHaveBeenCalled();
        expect(mockClientClose).toHaveBeenCalled();
    });

    test("calls closeAlert when no files are currently processing", async () => {
        const mockToArray = jest.fn().mockResolvedValue([]);

        const mockCollection = {
            find: jest.fn().mockReturnThis(),
            toArray: mockToArray
        };

        const mockClientClose = jest.fn();

        (getMongoDatabase as jest.Mock).mockResolvedValue({
            db: {
                collection: jest.fn().mockReturnValue(mockCollection)
            },
            client: {
                close: mockClientClose
            }
        });

        await checkFileDownloadProcessing();

        expect(closeOpenAlert).toHaveBeenCalledWith(
            CartaAlerts.File_Download_Processing_Delay
        );
        expect(createAlert).not.toHaveBeenCalled();
        expect(mockCollection.find).toHaveBeenCalledWith({
            status: "submitted",
            created_time: {
                $lte: expect.any(Date)
            }
        });
        expect(mockToArray).toHaveBeenCalled();
        expect(mockClientClose).toHaveBeenCalled();
    });
});
