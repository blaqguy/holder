import { Handler } from 'aws-lambda';
import {
  DynamoDBClient,
  BatchWriteItemCommandInput,
  BatchWriteItemCommand,
  BatchWriteItemCommandOutput,
  ScanCommand,
  ScanOutput,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  RDSClient,
  DescribeExportTasksCommand,
  DescribeExportTasksCommandInput,
  DescribeExportTasksCommandOutput,
  ExportTask,
} from '@aws-sdk/client-rds';
import {
  SchedulerClient,
  DeleteScheduleCommand,
  DeleteScheduleCommandInput,
} from '@aws-sdk/client-scheduler';
import axios from 'axios';

/**
 * * Get run time variables from environment variables
 * * Run them through a checkUndefined function to make sure undefined value was not passed in
 */
export interface ProcessEnvVars {
  snapshotIdTableName: string;
  backupFrequency: string;
  webhookUrl: string;
  accountName: string;
  taskCheckerSchedulerName: string;
}
interface SuccessResponse {
  statusCode: number;
  body: {
    message: string[];
  };
}

interface SchedulerState {
  backupSnapshots: boolean;
}

const {
  snapshotIdTableName,
  backupFrequency,
  webhookUrl,
  accountName,
  taskCheckerSchedulerName,
} = checkUndefined({
  snapshotIdTableName: process.env.snapshotIdTableName,
  backupFrequency: process.env.backupFrequency,
  webhookUrl: process.env.webhookUrl,
  accountName: process.env.accountName,
  taskCheckerSchedulerName: process.env.taskCheckerSchedulerName,
}) as ProcessEnvVars;

function checkUndefined(obj: { [key: string]: string | undefined }): {} {
  Object.entries(obj).forEach(([key, value]) => {
    checkUndefinedValue(value, key);
  });
  return obj;
}

function checkUndefinedValue(value: string | undefined, key?: string): string {
  if (value === undefined) {
    throw new Error(`${key} is undefined`);
  }
  return value;
}

const rdsClient = new RDSClient({});
const dynamoClient = new DynamoDBClient({});
const schedulerClient = new SchedulerClient({});

async function scanDynamoTable(tableName: string, primaryKey: string) {
  console.log(`About to scan the ${tableName} dynamoDB table`);

  const scannedItems: Record<string, AttributeValue>[] = [];

  const scanResponse: ScanOutput = await dynamoClient.send(
    new ScanCommand({
      TableName: tableName,
    })
  );

  if (scanResponse.Items && scanResponse.Items.length > 0) {
    console.log(
      `${tableName} dynamodb table has ${scanResponse.Count} item(s)`
    );

    scannedItems.push(...scanResponse.Items);
  } else {
    console.log(`No ${primaryKey} records found in ${tableName}`);
  }

  return scannedItems;
}

/**
 * Loop through the export tasks and respond based on the task progress
 * Completed: Remove from dynamoDb
 * Failed: Report to teams channel and remove from dynamoDb
 * InProgress: Do nothing
 * Canceled: Remove from dynamoDb
 * @param dynamoRecords
 * @returns string[]
 */
async function getSnapshotStorageTasks(
  dynamoRecords: Record<string, AttributeValue>[]
) {
  console.log('Starting the describe export rds snapshot task commands');

  const statusMessages: string[] = [];
  const inProgressTasks: ExportTask[] = [];
  const failedTasks: ExportTask[] = [];
  const canceledTasks: string[] = [];
  const completedTasks: string[] = [];

  // Check the progress of each export rds snapshot to S3 task that is running
  for (const record of dynamoRecords) {
    record.ExportTaskId.S = checkUndefinedValue(record.ExportTaskId.S); //Return string value of ExportTaskId item
    record.SourceArn.S = checkUndefinedValue(record.SourceArn.S); //Return string value of SourceArn item

    const params: DescribeExportTasksCommandInput = {
      ExportTaskIdentifier: record.ExportTaskId.S,
      SourceArn: record.SourceArn.S,
    };

    const { ExportTasks }: DescribeExportTasksCommandOutput =
      await rdsClient.send(new DescribeExportTasksCommand(params));

    if (ExportTasks && ExportTasks.length > 0) {
      ExportTasks.forEach((task) => {
        task.Status = checkUndefinedValue(task.Status);
        task.ExportTaskIdentifier = checkUndefinedValue(
          task.ExportTaskIdentifier
        );
        switch (task.Status) {
          case 'STARTING':
          case 'IN_PROGRESS':
            inProgressTasks.push(task);
            break;
          case 'COMPLETE':
            completedTasks.push(task.ExportTaskIdentifier);
            break;
          case 'FAILED':
            failedTasks.push(task);
            break;
          case 'CANCELED':
          case 'CANCELING':
            canceledTasks.push(task.ExportTaskIdentifier);
            break;
          default:
            console.error(
              `Unexpected task state of ${task.Status} for ${task.ExportTaskIdentifier} export task`
            );
        }
      });
    }
  }

  // Add in progress tasks to status messages
  if (inProgressTasks.length > 0) {
    statusMessages.push(
      `There are ${inProgressTasks.length} export-rds-snapshot-to-s3 task(s) still in progress`
    );
  }

  // Remove Export Task IDs from dynamoDB if their tasks completed successfully
  if (completedTasks.length > 0) {
    statusMessages.push(
      `There are ${completedTasks.length} completed export-rds-snapshot-to-s3 task(s)`
    );

    await removeFromDynamo(snapshotIdTableName, 'ExportTaskId', completedTasks);
  }

  // Remove Export Task IDs from dynamoDB if their tasks completed successfully
  if (canceledTasks.length > 0) {
    statusMessages.push(
      `There are ${completedTasks.length} canceled export-rds-snapshot-to-s3 task(s)`
    );

    await removeFromDynamo(snapshotIdTableName, 'ExportTaskId', canceledTasks);
  }

  // Gather all failed Export Task IDs for deletion
  if (failedTasks.length > 0) {
    statusMessages.push(
      `There are ${failedTasks.length} failed export-rds-snapshot-to-s3 task(s)`
    );

    const failedList: string[] = [];
    const failedTaskIds = failedTasks.map((task) => {
      const taskId = checkUndefinedValue(task.ExportTaskIdentifier);
      failedList.push(
        `Export task ID ${taskId} failed to export the rds backup snapshot to s3 bucket/path "${task.S3Bucket}/${task.S3Prefix}" because ${task.WarningMessage}`
      );
      return taskId;
    });

    await sendTeamsNotification(failedList);
    await removeFromDynamo(snapshotIdTableName, 'ExportTaskId', failedTaskIds);
  }

  return statusMessages;
}

async function sendTeamsNotification(messages: string[]) {
  console.log('Sending failed tasks message to teams notification channel now');

  // Mapping each error with its index, adding 1 to start the list at 1
  const formattedErrors: string = messages
    .map((message, index) => `${index + 1}. ${message}`)
    .join('\n');

  const message = `List of errors received by the lambda: ${formattedErrors}`;

  const teamsCard = {
    type: 'message',
    summary: 'Association Apply in Progress',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          msteams: {
            width: 'Full',
          },
          body: [
            {
              type: 'Container',
              items: [
                {
                  type: 'TextBlock',
                  text: '🚨 Aws Backup RDS Cold Storage Task Checker Process Has Failed Tasks',
                  weight: 'Bolder',
                  color: 'Attention',
                  size: 'Medium',
                  wrap: true,
                },
              ],
              style: 'emphasis',
            },
            {
              type: 'ColumnSet',
              columns: [
                {
                  type: 'Column',
                  width: 'auto',
                  items: [
                    {
                      type: 'TextBlock',
                      text: 'Account',
                      weight: 'bolder',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Region',
                      weight: 'bolder',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Messages',
                      weight: 'bolder',
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: accountName,
                      wrap: true,
                    },
                    {
                      type: 'TextBlock',
                      text: process.env.AWS_REGION,
                      wrap: true,
                    },
                    {
                      type: 'TextBlock',
                      text: message,
                      wrap: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };

  try {
    await axios.post(webhookUrl, teamsCard);
  } catch (error) {
    console.error('Error sending Teams Failure message', error);
    throw error;
  }
}

async function removeFromDynamo(
  tableName: string,
  primaryKey: string,
  itemList: string[]
) {
  console.log(
    `About to remove the ${primaryKey}(s) from the ${tableName} dynamoDB table`
  );
  console.log('Item list to delete: ', itemList);

  // Loop through backupImages and add ImageIds as the stored items
  const batchWriteRequest: BatchWriteItemCommandInput = {
    RequestItems: {
      [tableName]: itemList.map((item) => ({
        DeleteRequest: {
          Key: {
            [primaryKey]: {
              S: item,
            },
          },
        },
      })),
    },
  };

  const batchWriteResponse: BatchWriteItemCommandOutput =
    await dynamoClient.send(new BatchWriteItemCommand(batchWriteRequest));
  console.log('Batch write response: ', batchWriteResponse);

  console.log(
    `Removed backup Export task ID(s) from the ${tableName} dynamoDB table`
  );
}

async function deleteSchedulerSchedule(successResponse: SuccessResponse) {
  console.log('About to delete hourly scheduler');
  const params: DeleteScheduleCommandInput = {
    Name: taskCheckerSchedulerName,
  };
  const response = await schedulerClient.send(
    new DeleteScheduleCommand(params)
  );
  console.log('Scheduler deletion response: ', response);
  successResponse.body.message.push(
    'Removed hourly rds task checker lambda scheduler'
  );
}

/**
 * STEPS FOR BACKUP RDS SNAPSHOT IDS
 */
async function processBackupSnapshotIds(
  successResponse: SuccessResponse,
  finishedState: SchedulerState
) {
  const backupSnapshotIds = await scanDynamoTable(
    snapshotIdTableName,
    'ExportTaskId'
  );
  if (backupSnapshotIds.length === 0) {
    successResponse.body.message.push(
      `No RDS Backup export task IDs in the ${snapshotIdTableName} dynamoDb table`
    );
    //Set backupSnapshots finishedState to true
    finishedState.backupSnapshots = true;
    return;
  }
  const statusMessages = await getSnapshotStorageTasks(backupSnapshotIds);

  if (statusMessages.length > 0) {
    successResponse.body.message.push(...statusMessages);
  }
}

export const handler: Handler = async () => {
  console.log(
    `${backupFrequency.toUpperCase()} backup RDS snapshot cold storage task checker lambda has started`
  );
  const successResponse = {
    statusCode: 200,
    body: {
      message: [],
    },
  };

  const finishedState: SchedulerState = {
    backupSnapshots: false,
  };

  try {
    // Process backup RDS snapshot IDs
    await processBackupSnapshotIds(successResponse, finishedState);

    console.log('Scheduler finished state values: ', finishedState);

    // Delete the hourly task checker scheduler if backup snapshots are finished processing
    if (finishedState.backupSnapshots) {
      await deleteSchedulerSchedule(successResponse);
    }

    console.log(successResponse);
    return successResponse;
  } catch (error) {
    console.error(
      'Error running rds cold storage task processor lambda process',
      error
    );
    await sendTeamsNotification([
      `Error running rds cold storage task processor lambda process ${error}`,
    ]);
    throw error;
  }
};
