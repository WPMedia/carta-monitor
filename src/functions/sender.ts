import { Lambda } from "@aws-sdk/client-lambda";

const lambdaClient = new Lambda({ region: "us-east-1" });

const sendEvent = {
    subject:
        '[[ "example" | capitalize ]] test email send from carta-monitor to [[ email ]]',
    from: "email-stage@washpost.com",
    textBody: '[[ "example" | capitalize ]]',
    to: [
        {
            email: "jack.nugent@washpost.com"
        }
    ],
    body: Buffer.from(
        "<html><body>Example Test Email: [[ email ]]</body></html>"
    ).toString("base64")
};

export const sender = async () => {
    // TODO -- replace ARN with in-progress private endpoint from CAR-6227
    const params = {
        FunctionName: process.env.NONPERSONALIZED_SENDER_LAMBDA_ARN,
        InvocationType: "RequestResponse",
        Payload: new TextEncoder().encode(JSON.stringify(sendEvent))
    };

    try {
        const response = await lambdaClient.invoke(params);
        console.log("Lambda invocation response:", response);
        return response;
    } catch (error) {
        console.error("Failed to invoke Lambda function:", error);
        throw error;
    }
};
