import { closeOpenAlert, createAlert } from "../opsGenie";
import { CartaAlerts } from "../alerts";
import fetch from "cross-fetch";
import { getSsmCache } from "../ssm";
import { environmentVariables } from "../environmentVariables";

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
    const ssmCache = await getSsmCache();
    const cartaSenderKey = ssmCache["carta.sender.endpoint.access.key"];

    const response = await fetch(
        environmentVariables.NONPERSONALIZED_SENDER_URL,
        {
            method: "POST",
            headers: {
                "x-api-key": cartaSenderKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(sendEvent)
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to send email: ${response.status} ${response.statusText}`
        );
    }

    return (await response.json()) as SendResult;
};

export const sender = async () => {
    let result: SendResult;

    try {
        result = await sendEmail();
        if ("error" in result || result.totalFailedSends > 0) {
            throw new Error(JSON.stringify(result));
        }
    } catch (error) {
        createAlert(
            CartaAlerts.Carta_Sender,
            `Failed to send to carta-sender: ${error.message}`
        );
        return;
    }

    closeOpenAlert(CartaAlerts.Carta_Sender);

    return {
        statusCode: 200,
        body: JSON.stringify("Success"),
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        }
    };
};
