import { DateTime } from "luxon";
import { getCartaServer } from "../cartaServer";
import { createAndSendLetter } from "./sendScheduling";

jest.mock("../cartaServer", () => ({
    getCartaServer: jest.fn()
}));

jest.mock("../environmentVariables", () => ({
    environmentVariables: {}
}));

describe("createAndSendLetter function", () => {
    let mockServer;

    beforeEach(() => {
        mockServer = {
            Letters: {
                createLetter: jest.fn(),
                sendFinal: jest.fn()
            }
        };
        (getCartaServer as jest.Mock).mockReturnValue(mockServer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should create and send letter successfully", async () => {
        const letterType = "personalized";
        const campaignId = "123";

        mockServer.Letters.createLetter.mockResolvedValue({
            updatedDocId: "321"
        });
        mockServer.Letters.sendFinal.mockResolvedValue({ status: "success" });

        await createAndSendLetter(letterType, campaignId);

        expect(mockServer.Letters.createLetter).toHaveBeenCalledWith(
            `p0-${letterType}-${DateTime.fromJSDate(new Date()).toFormat(
                "yyyy-MM-dd HH:mm:ss"
            )}`,
            campaignId
        );
        expect(mockServer.Letters.sendFinal).toHaveBeenCalledWith(
            "321",
            campaignId,
            "scheduled",
            [expect.any(Number)]
        );
    });

    it("should throw an error if creating a letter fails", async () => {
        const letterType = "personalized";
        const campaignId = "123";

        mockServer.Letters.createLetter.mockResolvedValue({
            updatedDocId: null
        });

        await expect(
            createAndSendLetter(letterType, campaignId)
        ).rejects.toThrow(`Failed to create letter for ${campaignId}`);
    });

    it("should throw an error if sending a letter fails", async () => {
        const letterType = "personalized";
        const campaignId = "123";

        mockServer.Letters.createLetter.mockResolvedValue({
            updatedDocId: "321"
        });
        mockServer.Letters.sendFinal.mockResolvedValue({ status: "failure" });

        await expect(
            createAndSendLetter(letterType, campaignId)
        ).rejects.toThrow("Send letter endpoint returned a failure");
    });
});
