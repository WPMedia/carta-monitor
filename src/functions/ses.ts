import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

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

module.exports.ses = () => {
    try {
        sendTestEmail("us-east-1");
    } catch (error) {
        console.error(`Failed to send test email to us-east-1: ${error}`);
    }

    try {
        sendTestEmail("us-west-2");
    } catch (error) {
        console.error(`Failed to send test email to us-west-2: ${error}`);
    }
};
