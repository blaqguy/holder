import { Handler } from 'aws-lambda';
import {
  DynamoDBClient,
  ScanCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommand,
  BatchWriteItemCommandOutput,
  ScanOutput,
  AttributeValue,
  UpdateItemCommand,
  UpdateItemCommandOutput,
  UpdateItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import {
  EC2Client,
  DescribeStoreImageTasksCommand,
  DescribeStoreImageTasksCommandInput,
  DescribeStoreImageTasksCommandOutput,
  StoreImageTaskResult,
  DescribeSnapshotsCommandInput,
  DescribeSnapshotsCommand,
  ModifySnapshotTierRequest,
  ModifySnapshotTierResult,
  ModifySnapshotTierCommand,
  Snapshot,
} from '@aws-sdk/client-ec2';
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
  imageIdTableName: string;
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
  backupImages: boolean;
  backupSnapshots: boolean;
}

const {
  imageIdTableName,
  snapshotIdTableName,
  backupFrequency,
  webhookUrl,
  accountName,
  taskCheckerSchedulerName,
} = checkUndefined({
  imageIdTableName: process.env.imageIdTableName,
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

const dynamoClient = new DynamoDBClient({});
const ec2Client = new EC2Client({});
const schedulerClient = new SchedulerClient({});

interface SuccessResponse {
  statusCode: number;
  body: {
    message: string[];
  };
}

/**
 * Loop through the Image IDs in dynamoDb and retrieve info for the storage tasks
 *
 * @param dynamoRecords
 * @returns StoreImageTaskResults[]
 */
async function getAmiStorageTasks(
  dynamoRecords: Record<string, AttributeValue>[]
) {
  console.log('Starting the describe store image task commands');
  const imageIds = dynamoRecords.map((record) => {
    return checkUndefinedValue(record.ImageId.S); //Return string value of ImageId item
  });

  const storeImageTasks: StoreImageTaskResult[] = [];
  let nextToken: string | undefined;

  do {
    // Check the progress of each store image task that is running
    const params: DescribeStoreImageTasksCommandInput = {
      ImageIds: imageIds,
      NextToken: nextToken,
    };
    const {
      StoreImageTaskResults,
      NextToken,
    }: DescribeStoreImageTasksCommandOutput = await ec2Client.send(
      new DescribeStoreImageTasksCommand(params)
    );

    if (StoreImageTaskResults && StoreImageTaskResults.length > 0) {
      storeImageTasks.push(...StoreImageTaskResults);
    }

    nextToken = NextToken;
  } while (nextToken);

  return storeImageTasks;
}

/**
 * Loop through the storage tasks and respond based on the task state
 * Completed: Remove from dynamoDb
 * Failed: Report to teams channel and remove from dynamoDb
 * InProgress: Do nothing
 * @param storeImageTasks
 */
async function getImageStorageTaskProgress(
  storeImageTasks: StoreImageTaskResult[]
) {
  const statusMessages: string[] = [];
  const inProgressTasks: string[] = [];
  const failedTasks: StoreImageTaskResult[] = [];
  const completedAmiIds: string[] = [];

  storeImageTasks.forEach((task) => {
    task.AmiId = checkUndefinedValue(task.AmiId);
    switch (task.StoreTaskState) {
      case 'Completed':
        completedAmiIds.push(task.AmiId);
        break;
      case 'Failed':
        failedTasks.push(task);
        break;
      case 'InProgress':
        inProgressTasks.push(task.AmiId);
        break;
      default:
        console.error(
          `Unexpected task state of ${task.StoreTaskState} for ${task.AmiId}`
        );
    }
  });

  // Remove AMI IDs from dynamoDB if their tasks completed successfully
  if (completedAmiIds.length > 0) {
    statusMessages.push(
      `There are ${completedAmiIds.length} completed store-image-to-s3 task(s)`
    );
    await removeFromDynamo(imageIdTableName, 'ImageId', completedAmiIds);
  }

  // Gather all failed AMI ids for deletion
  if (failedTasks.length > 0) {
    statusMessages.push(
      `There are ${failedTasks.length} failed store-image-to-s3 tasks`
    );

    const failedAmiIds = failedTasks.map((failedTask) => {
      return checkUndefinedValue(failedTask.AmiId);
    });

    const failedList = failedTasks.map((task) => {
      return `AMI ID ${task.AmiId} failed to store to s3 bucket "${task.Bucket}" because ${task.StoreTaskFailureReason}`;
    });
    await sendTeamsNotification(failedList);
    await removeFromDynamo(imageIdTableName, 'ImageId', failedAmiIds);
  }

  if (inProgressTasks.length > 0) {
    statusMessages.push(
      `There are ${inProgressTasks.length} store-image-to-s3 task(s) still in progress`
    );
  }
  return statusMessages;
}

/**
 * Loop through each snapshot ID and handle each based on the dynamoDb attribute 'Status', StorageTask 'State', and StorageTask 'Tier'
 * Copying & Pending: Do Nothing
 * Copying & Completed: Begin archiving and update the dynamoDb attribute 'Status' to 'archiving'.
 * Copying & Error: Add to a failedList to send teams notification and remove the snapshot records from dynamo
 *
 * Archiving & Standard Tier: DO NOTHING, snapshot is still archiving
 * Archiving & Archived Tier: Delete the snapshotId from dynamoDb since it is now archived
 * Check if each snapshotId is finished copying and if it is then run the archive command
 * @param snapshotIdRecords
 */
async function getCopySnapshotProgress(
  snapshotIdRecords: Record<string, AttributeValue>[]
) {
  console.log('Getting AWS Backup EBS volume snapshots copy progress');

  const statusMessages: string[] = [];
  const snapshotsCopying: string[] = [];
  const snapshotsArchiving: string[] = [];
  const failedSnapshots: Snapshot[] = [];

  /**
   * Check the status of the dynamoDB record and separate between
   * snapshots that are being copied and snapshots that are being archived
   */
  snapshotIdRecords.forEach((record) => {
    record.SnapshotId.S = checkUndefinedValue(record.SnapshotId.S);
    switch (record.Status.S) {
      case 'copying':
        snapshotsCopying.push(record.SnapshotId.S);
        break;
      case 'archiving':
        snapshotsArchiving.push(record.SnapshotId.S);
        break;
      default:
        console.error(
          `Unexpected dynamoDb record status of ${record.Status.S} for ${record.SnapshotId.S}`
        );
    }
  });

  if (snapshotsCopying.length > 0) {
    statusMessages.push(
      `There are ${snapshotsCopying.length} snapshot ids in dynamoDB with 'copying' status`
    );
    const completeCopiedSnaps: Snapshot[] = [];

    const copyingSnapshots = await describeSnapshotTask(snapshotsCopying);
    if (copyingSnapshots.length === 0) {
      statusMessages.push(
        `The DescribeSnapshotCommand returned empty for ${snapshotsCopying}`
      );
    }

    /**
     * Check the describe response for snapshot 'State' types:
     * "pending"
     * "completed"
     * "error"
     * "recoverable"
     * "recovering";
     */
    copyingSnapshots.forEach((snapshot) => {
      switch (snapshot.State) {
        case 'completed':
          completeCopiedSnaps.push(snapshot);
          break;
        case 'error':
          failedSnapshots.push(snapshot);
          break;
        //DO NOTHING. Need to recheck so don't remove the dynamoDb record and don't start achive yet.
        case 'pending':
        case 'recoverable':
        case 'recovering':
          break;
        default:
          console.error(
            `Unexpected snapshot state of ${snapshot.State} for ${snapshot.SnapshotId}`
          );
      }
    });

    if (completeCopiedSnaps.length === 0) {
      statusMessages.push(
        `There are 0 completed snapshots to archive at this time`
      );
    } else {
      statusMessages.push(
        `There are ${completeCopiedSnaps.length} snapshot ids that have finished copying`
      );
      await archiveBackupSnapshot(completeCopiedSnaps);

      //Set batch size to be 20 for concurrency management
      const batchSize = 20;
      for (let i = 0; i < completeCopiedSnaps.length; i += batchSize) {
        const batch = completeCopiedSnaps.slice(i, i + batchSize);
        try {
          console.log(
            'Updating snapshot record status from "copying" to "archiving"'
          );
          await Promise.all(
            batch.map((snapshot) => {
              snapshot.SnapshotId = checkUndefinedValue(snapshot.SnapshotId);
              updateSnapshotRecord(snapshot.SnapshotId);
            })
          );
          console.log(`Batch ${i / batchSize + 1} updated successfully`);
        } catch (error) {
          console.error(`Error updating batch ${i / batchSize + 1}: `, error);
        }
      }
      statusMessages.push(
        `Updated ${completeCopiedSnaps.length} snapshot id records status from "copying" to "archiving"`
      );
    }
  }

  if (snapshotsArchiving.length > 0) {
    statusMessages.push(
      `There are ${snapshotsArchiving.length} snapshots with 'archiving' status`
    );

    const completeArchivedSnaps: Snapshot[] = [];

    const archivingSnapshots = await describeSnapshotTask(snapshotsArchiving);

    if (archivingSnapshots.length === 0) {
      statusMessages.push(
        `The DescribeSnapshotCommand returned empty for ${archivingSnapshots}`
      );
    } else {
      /**
       * Check the describe response for snapshot 'StorageTier' Types:
       * standard
       * archive
       */
      archivingSnapshots.forEach((snapshot) => {
        switch (snapshot.StorageTier) {
          case 'archive': //Archiving is completed
            completeArchivedSnaps.push(snapshot);
            break;
          case 'standard': //Still being archived so DO NOTHING
            break;
          default:
            console.error(
              `Unexpected snapshot StorageTier of ${snapshot.StorageTier} for ${snapshot.SnapshotId}`
            );
        }
      });

      if (completeArchivedSnaps.length > 0) {
        statusMessages.push(
          `There are ${completeArchivedSnaps.length} snapshots that are finished archiving and being removed from dynamoDb`
        );
        const snapshotIds = completeArchivedSnaps.map((snapshot) => {
          return checkUndefinedValue(snapshot.SnapshotId);
        });
        await removeFromDynamo(snapshotIdTableName, 'SnapshotId', snapshotIds);
      }
    }
  }

  if (failedSnapshots.length > 0) {
    statusMessages.push(
      `There are ${failedSnapshots.length} snapshots that failed to copy`
    );

    const failedList = failedSnapshots.map((snapshot) => {
      return `Snapshot ID ${snapshot.SnapshotId} for volume ${snapshot.VolumeId} failed to copy and is in ${snapshot.State} with message ${snapshot.StateMessage}`;
    });

    await sendTeamsNotification(failedList);

    const failedSnapshotIds: string[] = [];

    failedSnapshots.forEach((failedSnapshot) => {
      failedSnapshot.SnapshotId = checkUndefinedValue(
        failedSnapshot.SnapshotId
      );
      failedSnapshotIds.push(failedSnapshot.SnapshotId);
    });

    await removeFromDynamo(
      snapshotIdTableName,
      'SnapshotId',
      failedSnapshotIds
    );
  }

  return statusMessages;
}

async function describeSnapshotTask(snapshotIds: string[]) {
  console.log('About to run describeSnapshotsCommand');
  let nextToken: string | undefined;
  const totalSnapshots: Snapshot[] = [];
  do {
    const describeParams: DescribeSnapshotsCommandInput = {
      SnapshotIds: snapshotIds,
    };

    const { Snapshots, NextToken } = await ec2Client.send(
      new DescribeSnapshotsCommand(describeParams)
    );
    if (Snapshots && Snapshots.length > 0) {
      totalSnapshots.push(...Snapshots);
    }

    nextToken = NextToken;
  } while (nextToken);

  return totalSnapshots;
}

async function archiveBackupSnapshot(snapshots: Snapshot[]) {
  console.log('Beginning to archive copied snapshots');
  for (const snapshot of snapshots) {
    const params: ModifySnapshotTierRequest = {
      SnapshotId: snapshot.SnapshotId,
      StorageTier: 'archive',
    };

    await ec2Client.send(new ModifySnapshotTierCommand(params));
  }
  console.log(
    'Archive snapshot process has begun for all copied backup snapshot IDs'
  );
}

/**
 * Update the snapshot status to 'archiving
 * @param snapshotId
 */
async function updateSnapshotRecord(snapshotId: string) {
  const updateInput: UpdateItemCommandInput = {
    TableName: snapshotIdTableName,
    Key: {
      SnapshotId: {
        S: snapshotId,
      },
    },
    UpdateExpression: 'set #statusAttribute = :status',
    // Define the placeholder and map it to the actual attribute name because 'Status' is a keyword
    ExpressionAttributeNames: {
      '#statusAttribute': 'Status',
    },
    ExpressionAttributeValues: {
      ':status': {
        S: 'archiving',
      },
    },
    ReturnValues: 'ALL_NEW',
  };

  const updateItemResponse: UpdateItemCommandOutput = await dynamoClient.send(
    new UpdateItemCommand(updateInput)
  );
}

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
                  text: '🚨 Aws Backup EC2 Cold Storage Task Checker Process Has Failed Tasks',
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

  console.log(`Removed backup Image IDs from the ${tableName} dynamoDB table`);
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
    'Removed hourly ec2 task checker lambda scheduler'
  );
}

/**
 * STEPS FOR BACKUP IMAGE IDS
 */
async function processBackupImageIds(
  successResponse: SuccessResponse,
  finishedState: SchedulerState
) {
  console.log('Beginning to process backup image tasks');
  const dynamoRecords = await scanDynamoTable(imageIdTableName, 'ImageId');
  if (dynamoRecords.length === 0) {
    successResponse.body.message.push(
      `No EC2 Backup AMIs IDs in the ${imageIdTableName} dynamoDb table`
    );
    //Set backupImages finishedState to true
    finishedState.backupImages = true;
    return;
  }

  const storeImageTasks = await getAmiStorageTasks(dynamoRecords);
  if (storeImageTasks.length === 0) {
    successResponse.body.message.push(
      `No store image tasks were found for the Image IDs given`
    );
    return;
  }

  const statusMessages = await getImageStorageTaskProgress(storeImageTasks);
  if (statusMessages.length > 0) {
    successResponse.body.message.push(...statusMessages);
  }
}

/**
 * STEPS FOR BACKUP SNAPSHOT IDS
 */
async function processBackupSnapshotIds(
  successResponse: SuccessResponse,
  finishedState: SchedulerState
) {
  const backupSnapshotIds = await scanDynamoTable(
    snapshotIdTableName,
    'SnapshotId'
  );
  if (backupSnapshotIds.length === 0) {
    successResponse.body.message.push(
      `No EC2 Backup snapshot IDs in the ${snapshotIdTableName} dynamoDb table`
    );
    //Set backupSnapshots finishedState to true
    finishedState.backupSnapshots = true;
    return;
  }

  const statusMessages = await getCopySnapshotProgress(backupSnapshotIds);
  if (statusMessages.length > 0) {
    successResponse.body.message.push(...statusMessages);
  }
}

export const handler: Handler = async () => {
  console.log(
    `${backupFrequency.toUpperCase()} ami and snapshot cold storage task checker lambda has started`
  );
  const successResponse: SuccessResponse = {
    statusCode: 200,
    body: {
      message: [],
    },
  };
  const finishedState: SchedulerState = {
    backupImages: false,
    backupSnapshots: false,
  };

  try {
    // Process backup image IDs
    await processBackupImageIds(successResponse, finishedState);

    // Process backup snapshot IDs
    await processBackupSnapshotIds(successResponse, finishedState);

    console.log('Scheduler finished state values: ', finishedState);

    // Delete the hourly task checker scheduler if backup images and snapshots are finished archiving
    if (finishedState.backupImages && finishedState.backupSnapshots) {
      await deleteSchedulerSchedule(successResponse);
    }

    console.log(successResponse);
    return successResponse;
  } catch (error) {
    console.error(
      'Error running ec2 cold storage task processor lambda process',
      error
    );
    await sendTeamsNotification([
      `Error running ec2 cold storage task processor lambda process ${error}`,
    ]);
    throw error;
  }
};
