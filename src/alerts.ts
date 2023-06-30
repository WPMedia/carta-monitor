import { envVars } from "./environmentVariables";
import { sendFilters } from "./mongo";

export enum Priority {
    P0 = "P0",
    P1 = "P1",
    P2 = "P2",
    P3 = "P3"
}

export const enum CartaAlerts {
    // Schedule alerts
    // These alerts check if there have been any 'send' events in the past 15 and 30 minutes for different types of sends.
    // If no activity is detected, an alert is triggered.
    // How to test: go to campaigns from .env (CAMPAIGN_ID's and ALERT_CAMPAIGN_NAME)
    // and in Carta UI, do something that breaks the send
    // such as remove Recipients from Recipients List, break template, etc.
    Schedule_Transactional_Send = "Schedule_Transactional_Send",
    Schedule_Personalized_Send = "Schedule_Personalized_Send",
    Schedule_Nonpersonalized_Send = "Schedule_Nonpersonalized_Send",
    Alert_Send = "Alert_Send",

    // No sends alerts
    // These alerts check if there have been no 'send' events in the past X and X + Y minutes for different types of sends.
    // If no sends are detected, an alert is triggered.
    Transactional_Send_Delay_P2 = "Transactional_Send_Delay_P2",
    Transactional_Send_Delay_P1 = "Transactional_Send_Delay_P1",
    Personalized_Send_Delay_P2 = "Personalized_Send_Delay_P2",
    Personalized_Send_Delay_P1 = "Personalized_Send_Delay_P1",
    NonPersonalized_Send_Delay_P2 = "NonPersonalized_Send_Delay_P2",
    NonPersonalized_Send_Delay_P1 = "NonPersonalized_Send_Delay_P1",
    Alert_Send_Delay_P2 = "Alert_Send_Delay_P2",
    Alert_Send_Delay_P1 = "Alert_Send_Delay_P1",

    // Metrics alerts
    // These alerts check if the volume of documents in the 'events' collection exceeds a threshold.
    // How to test: reduce METRICS_EVENTS_COUNT_ALERT_THRESHHOLD .env to something very low, then trigger metrics events to process
    Metrics_Processing_Above_Threshshold = "Metrics_Processing_Above_Threshshold", // Events collection is backed up

    // File download alerts
    // These alerts check for delayed processing of file downloads.
    // How to test: reduce FILE_DOWNLOAD_PROCESSING_THRESHHOLD_MINUTES to a lower threshhold, then trigger a large file download
    File_Download_Processing_Delay = "File_Download_Processing_Delay", // File download processing is delayed more than 15 mins

    // Dynamic list alerts
    // These alerts check for processing delays in dynamic lists.
    Automatic_Dynamic_List = "Automatic_Dynamic_List", // Auto-running dynamic list(s) failed to run
    Scheduled_Dynamic_List = "Scheduled_Dynamic_List", // Scheduled dynamic list(s) failed to run

    // Campaign send alerts
    // These alerts monitor the status of newsletter campaigns and update their send state.
    // They also trigger alerts and escalate the alert level based on the campaign status.
    Multiple_Campaign_Send_Delay = "Multiple_Campaign_Send_Delay", // Email send of multiple campaigns is delayed.

    // Carta-sender
    Carta_Sender = "Carta_Sender",

    // Unknown issue with monitor
    Carta_Monitor_Error = "Carta_Monitor_Error"
}

interface AlertDetails {
    priority: Priority;
    message: string;
    description?: string;
}

export const alertDetails: { [K in CartaAlerts]: AlertDetails } = {
    [CartaAlerts.Schedule_Transactional_Send]: {
        priority: Priority.P2,
        message: "Failed to schedule a transactional send"
    },
    [CartaAlerts.Schedule_Personalized_Send]: {
        priority: Priority.P2,
        message: "Failed to send a personalized send"
    },
    [CartaAlerts.Schedule_Nonpersonalized_Send]: {
        priority: Priority.P2,
        message: "Failed to send a nonpersonalized send"
    },
    [CartaAlerts.Alert_Send]: {
        priority: Priority.P1,
        message: "Failed to send an alert send"
    },
    [CartaAlerts.Transactional_Send_Delay_P2]: {
        priority: Priority.P2,
        message: `Viewers don’t receive transactional emails in last ${envVars.SEND_DELAY_P2_MINUTES} mins`,
        description: `
        1. Check Transactional Campaign: ${envVars.TRANSACTIONAL_CAMPAIGN_ID}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["transactional"]
        )}, sorted by statusDoneTimestamp.`
    },
    [CartaAlerts.Personalized_Send_Delay_P2]: {
        priority: Priority.P2,
        message: `Viewers don’t receive personalized emails in last ${envVars.SEND_DELAY_P2_MINUTES} mins`,
        description: `
        1. Check Personalized Campaign: ${
            envVars.PERSONALIZED_CAMPAIGN_ID
        }       
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["personalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.NonPersonalized_Send_Delay_P2]: {
        priority: Priority.P2,
        message: `Viewers don’t receive nonpersonalized emails in last ${envVars.SEND_DELAY_P2_MINUTES} mins`,
        description: `
        1. Check Nonpersonalized Campaign: ${
            envVars.NONPERSONALIZED_CAMPAIGN_ID
        }
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["nonpersonalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.Alert_Send_Delay_P2]: {
        priority: Priority.P2,
        message: `Viewers don’t receive alerts in last ${envVars.SEND_DELAY_P2_MINUTES} mins`,
        description: `
        1. Check Alert Campaign: ${envVars.ALERT_CAMPAIGN_NAME}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["alert"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.Transactional_Send_Delay_P1]: {
        priority: Priority.P1,
        message: `Viewers don’t receive transactional emails in last ${envVars.SEND_DELAY_P1_MINUTES} mins`,
        description: `
        1. Check Transactional Campaign: ${envVars.TRANSACTIONAL_CAMPAIGN_ID}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["transactional"]
        )}, sorted by statusDoneTimestamp.`
    },
    [CartaAlerts.Personalized_Send_Delay_P1]: {
        priority: Priority.P1,
        message: `Viewers don’t receive personalized emails in last ${envVars.SEND_DELAY_P1_MINUTES} mins`,
        description: `
        1. Check Nonpersonalized Campaign: ${
            envVars.PERSONALIZED_CAMPAIGN_ID
        }       
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["personalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.NonPersonalized_Send_Delay_P1]: {
        priority: Priority.P1,
        message: `Viewers don’t receive nonpersonalized emails in last ${envVars.SEND_DELAY_P1_MINUTES} mins`,
        description: `
        1. Check Nonpersonalized Campaign: ${
            envVars.NONPERSONALIZED_CAMPAIGN_ID
        }
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["nonpersonalized"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.Alert_Send_Delay_P1]: {
        priority: Priority.P1,
        message: `Viewers don’t receive alerts in last ${envVars.SEND_DELAY_P1_MINUTES} mins`,
        description: `
        1. Check Alert Campaign: ${envVars.ALERT_CAMPAIGN_NAME}
        2. Check nlSend records with filter ${JSON.stringify(
            sendFilters["alert"]
        )}, sorted by statusDoneTimestamp`
    },
    [CartaAlerts.Metrics_Processing_Above_Threshshold]: {
        priority: Priority.P2,
        message: "Events collection is backed up",
        description:
            "Check if the metrics processor is running and progressing through entries in the events collection"
    },
    [CartaAlerts.File_Download_Processing_Delay]: {
        priority: Priority.P2,
        message: "File download processing is delayed more than 15 mins"
    },
    [CartaAlerts.Scheduled_Dynamic_List]: {
        priority: Priority.P2,
        message: "Scheduled dynamic list(s) failed to run"
    },
    [CartaAlerts.Automatic_Dynamic_List]: {
        priority: Priority.P2,
        message: "Auto-running dynamic list(s) failed to run"
    },
    [CartaAlerts.Multiple_Campaign_Send_Delay]: {
        priority: Priority.P1,
        message: "Email send of multiple campaigns is delayed."
    },
    [CartaAlerts.Carta_Sender]: {
        priority: Priority.P1,
        message: "Carta-sender returning failed response"
    },
    [CartaAlerts.Carta_Monitor_Error]: {
        priority: Priority.P3,
        message: "Carta-monitor threw an unexpected error"
    }
};
