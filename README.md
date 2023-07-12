# Serverless API: Typescript and Jest Template

## Offline Testing

```
. ./.envrc
export VPC=local

serverless invoke local --function sendScheduling
serverless invoke local --function sender
serverless invoke local --function testAlert
serverless invoke local --function metricsProcessing
serverless invoke local --function fileDownloadProcessing
serverless invoke local --function dynamicListProcessing
serverless invoke local --function campaignSendAlerts
serverless invoke local --function send
```

## Datadog/OpsGenie Integration

Within the [Washington Post DataDog account](https://wapo.datadoghq.com/apm/home), we actively monitor all carta-monitor Lambda functions to ensure they are running regularly. If none of the Lambda's in carta-monitor are running, Datadog will trigger an alert via OpsGenie (P3 in sandbox, P2 in prod).

If you wish to test this datadog alert integration, you can stop the scheduled runs of all Lambdas through modifications in the serverless.yml configuration file. Once you add back the scheduled runs of the Lambdas, the active alert in OpsGenie triggered by their stoppage will automatically close.

-   Here is the [Sandbox Monitor](https://wapo.datadoghq.com/monitors/124727536), plus an [example alert](https://washpost.app.opsgenie.com/alert/detail/22a1d1f7-8a77-4e3a-8050-8c51405541c1-1689010338026/logs)
-   Here is the [Prod Monitor](https://wapo.datadoghq.com/monitors/125071811), plus an [example alert](https://washpost.app.opsgenie.com/alert/detail/fc2e48eb-2296-4ff5-a26c-ad4e9a7a4c48-1689177491961/details)
