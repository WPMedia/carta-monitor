const EnvVars = [
    "NONPERSONALIZED_CAMPAIGN_ID",
    "PERSONALIZED_CAMPAIGN_ID",
    "TRANSACTIONAL_CAMPAIGN_ID",
    "LIST_MANAGEMENT_SEND_ALERT",
    "ALERT_CAMPAIGN_NAME",
    "ALERT_EMAIL_LIST",
    "OPS_GENIE_ENV",
    "MONGODB_NAME",
    "MONGODB_URI",
    "CARTA_UI_BASE_URL",
    "NONPERSONALIZED_SENDER_URL",
    "STAGE",
    "IS_LOCAL",
    "METRICS_EVENTS_COUNT_ALERT_THRESHHOLD",
    "FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES",
    "SENDS_PER_ALLOWED_TIME_SEGMENT",
    "MINUTES_PER_ALLOWED_TIME_SEGMENT",
    "SUCCESSFUL_SEND_COMPLETION_PERCENTAGE",
    "SEND_DELAY_P2_MINUTES",
    "SEND_DELAY_P1_MINUTES",
    "CARTA_SENDER_EMAIL"
] as const;

type EnvVar = (typeof EnvVars)[number];

type EnvVarValues = { [K in EnvVar]: string };

const getAndCheckRequiredEnvVars = () => {
    const cache: Partial<EnvVarValues> = {};

    for (const varName of EnvVars) {
        const value = process.env[varName];

        // Checks both for missing variables and empty/null strings
        if (!value) {
            throw new Error(
                `Missing or empty ${varName} in environment variables`
            );
        } else {
            cache[varName] = value;
        }
    }

    // Type assertion is safe here because we've filled in all properties
    return cache as EnvVarValues;
};

export const envVars = getAndCheckRequiredEnvVars();
