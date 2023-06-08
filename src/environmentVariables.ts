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
    IS_LOCAL = "IS_LOCAL"
}

type EnvVarValues = { [K in EnvVars]?: string };

let envCache: EnvVarValues;

const getAndCheckRequiredEnvVars = () => {
    for (const varName of Object.values(EnvVars)) {
        const value = process.env[varName];
        if (!value) {
            throw new Error(`Missing ${varName} in environment variables`);
        } else {
            envCache[varName as EnvVars] = value;
        }
    }
};

export const getEnvCache = (): EnvVarValues => {
    if (!envCache) {
        envCache = {};
        getAndCheckRequiredEnvVars();
    }
    return envCache;
};
