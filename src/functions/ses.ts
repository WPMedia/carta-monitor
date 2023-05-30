import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { CartaAlerts, closeAlert, createAlert } from "../opsGenieHelpers";

const fromEmail = "Carta test<wp.carta.test@gmail.com>"; // Replace with your sender email
const toEmail = "washpostqa1@gmail.com"; // Replace with your recipient email
const subject = "Test email"; // Replace with your email subject

const sendTestEmail = async (region: "us-east-1" | "us-west-2") => {
    const sesClient = new SESClient({ region });
    const bodyHtml = `This message is being sent to verify SES on ${region}`;
    const bodyText = `Test send from ${region}`;

    const params = {
        Destination: {
            ToAddresses: [toEmail]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: bodyHtml
                },
                Text: {
                    Charset: "UTF-8",
                    Data: bodyText
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: subject
            }
        },
        Source: fromEmail
    };

    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log(`Email sent: ${response.MessageId}`);
};

export const ses = async () => {
    try {
        await sendTestEmail("us-east-1");
        await closeAlert(CartaAlerts.Ses_UsEast1);
    } catch (error) {
        console.error(`Failed to send test email to us-east-1: ${error}`);
        await createAlert(CartaAlerts.Ses_UsEast1);
    }

    try {
        await sendTestEmail("us-west-2");
        await closeAlert(CartaAlerts.Ses_UsWest2);
    } catch (error) {
        console.error(`Failed to send test email to us-west-2: ${error}`);
        await createAlert(CartaAlerts.Ses_UsWest2);
    }
};
