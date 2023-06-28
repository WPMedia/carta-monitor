enum EnvVars {
    NONPERSONALIZED_CAMPAIGN_ID = "NONPERSONALIZED_CAMPAIGN_ID",
    PERSONALIZED_CAMPAIGN_ID = "PERSONALIZED_CAMPAIGN_ID",
    TRANSACTIONAL_CAMPAIGN_ID = "TRANSACTIONAL_CAMPAIGN_ID",
    LIST_MANAGEMENT_SEND_ALERT = "LIST_MANAGEMENT_SEND_ALERT",
    ALERT_CAMPAIGN_NAME = "ALERT_CAMPAIGN_NAME",
    ALERT_EMAIL_LIST = "ALERT_EMAIL_LIST",
    OPS_GENIE_ENV = "OPS_GENIE_ENV",
    MONGODB_NAME = "MONGODB_NAME",
    MONGODB_URI = "MONGODB_URI",
    CARTA_UI_BASE_URL = "CARTA_UI_BASE_URL",
    NONPERSONALIZED_SENDER_URL = "NONPERSONALIZED_SENDER_URL",
    STAGE = "STAGE",
    IS_LOCAL = "IS_LOCAL",
    METRICS_EVENTS_COUNT_ALERT_THRESHHOLD = "METRICS_EVENTS_COUNT_ALERT_THRESHHOLD",
    FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES = "FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES",
    SENDS_PER_ALLOWED_TIME_SEGMENT = "SENDS_PER_ALLOWED_TIME_SEGMENT",
    MINUTES_PER_ALLOWED_TIME_SEGMENT = "MINUTES_PER_ALLOWED_TIME_SEGMENT",
    SUCCESSFUL_SEND_COMPLETION_PERCENTAGE = "SUCCESSFUL_SEND_COMPLETION_PERCENTAGE"
}

type EnvVarValues = { [K in EnvVars]: string };

const getAndCheckRequiredEnvVars = () => {
    const cache: Partial<EnvVarValues> = {};

    for (const varName of Object.values(EnvVars)) {
        const value = process.env[varName];

        // Checks both for missing variables and empty/null strings
        if (!value) {
            throw new Error(
                `Missing or empty ${varName} in environment variables`
            );
        } else {
            cache[varName as EnvVars] = value;
        }
    }

    // Type assertion is safe here because we've filled in all properties
    return cache as EnvVarValues;
};

export const envVars = getAndCheckRequiredEnvVars();
