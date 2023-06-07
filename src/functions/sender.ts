import { closeOpenAlert, createAlert } from "../opsGenieHelpers";
import { CartaAlerts } from "../alerts";
import { getParametersFromSSM } from "../helpers";
import fetch from "cross-fetch";

const sendEvent = {
    subject:
        '[[ "example" | capitalize ]] test email send from carta-monitor to [[ email ]]',
    from: "email-stage@washpost.com",
    textBody: '[[ "example" | capitalize ]]',
    to: [
        {
            email: "carta-test@washpost.com"
        }
    ],
    body: Buffer.from(
        "<html><body>Example Test Email: [[ email ]]</body></html>"
    ).toString("base64")
};

type SendResult =
    | {
          totalFailedSends: number;
          totalSuccessfulSends: number;
      }
    | { error: Error };

const sendEmail = async () => {
    const cartaSenderKey = (
        await getParametersFromSSM(["carta.sender.endpoint.access.key"])
    )[0].value;

    const response = await fetch(process.env.NONPERSONALIZED_SENDER_URL, {
        method: "POST",
        headers: {
            "x-api-key": cartaSenderKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(sendEvent)
    });

    return (await response.json()) as SendResult;
};

export const sender = async () => {
    let sendError: string;
    let result: SendResult;

    try {
        result = await sendEmail();
    } catch (error: any) {
        sendError = JSON.stringify(error);
    }

    if ("error" in result || result.totalFailedSends > 0) {
        sendError = JSON.stringify(result);
    }

    if (sendError) {
        createAlert(
            CartaAlerts.Carta_Sender,
            `Failed to send to carta-sender: ${sendError}`
        );
        return;
    }

    closeOpenAlert(CartaAlerts.Carta_Sender);
};
