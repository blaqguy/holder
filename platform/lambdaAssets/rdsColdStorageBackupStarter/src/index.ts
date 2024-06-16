import { Handler } from 'aws-lambda';
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
  DBSnapshot,
  DescribeDBSnapshotsCommand,
  DescribeDBSnapshotsCommandInput,
  DescribeDBSnapshotsCommandOutput,
  RDSClient,
  StartExportTaskCommand,
  StartExportTaskCommandInput,
  StartExportTaskCommandOutput,
} from '@aws-sdk/client-rds';
import {
  SchedulerClient,
  CreateScheduleCommand,
  CreateScheduleCommandInput,
} from '@aws-sdk/client-scheduler';
import axios from 'axios';

/**
 * * Get run time variables from environment variables
 * * Run them through a checkUndefined function to make sure undefined value was not passed in
 */
export interface ProcessEnvVars {
  rdsSnapshotIdTableName: string;
  backupFrequency: string;
  coldStorageBucketName: string;
  rdsIamRole: string;
  rdsKmsKeyId: string;
  taskCheckerSchedulerName: string;
  taskCheckerLambdaArn: string;
  taskCheckerRoleArn: string;
  webhookUrl: string;
  accountName: string;
}

interface SuccessResponse {
  statusCode: number;
  body: {
    message: string[];
  };
}

interface SchedulerState {
  snapshots: boolean;
}

const {
  backupFrequency,
  rdsSnapshotIdTableName,
  coldStorageBucketName,
  rdsIamRole,
  rdsKmsKeyId,
  taskCheckerSchedulerName,
  taskCheckerLambdaArn,
  taskCheckerRoleArn,
  webhookUrl,
  accountName,
} = checkUndefined({
  backupFrequency: process.env.backupFrequency,
  rdsSnapshotIdTableName: process.env.rdsSnapshotIdTableName,
  coldStorageBucketName: process.env.coldStorageBucketName,
  rdsIamRole: process.env.rdsIamRole,
  rdsKmsKeyId: process.env.rdsKmsKeyId,
  taskCheckerSchedulerName: process.env.taskCheckerSchedulerName,
  taskCheckerLambdaArn: process.env.taskCheckerLambdaArn,
  taskCheckerRoleArn: process.env.taskCheckerRoleArn,
  webhookUrl: process.env.webhookUrl,
  accountName: process.env.accountName,
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

async function getRdsSnapshots() {
  console.log(`Getting RDS snapshots`);

  const backupSnapshots: DBSnapshot[] = [];
  let marker: string | undefined;

  do {
    // Create filter params for the describeImage command
    const params: DescribeDBSnapshotsCommandInput = {
      SnapshotType: 'awsbackup',
      Filters: [
        {
          Name: 'engine',
          Values: ['aurora-postgresql', 'postgres'], // Currently export to s3 is not supported for RDS for DB2, Oracle, or SQL Server
        },
      ],
      Marker: marker,
    };

    // Call the EC2 Describe Images command to get list of AMI Images from AWS Backup
    const { DBSnapshots, Marker }: DescribeDBSnapshotsCommandOutput =
      await rdsClient.send(new DescribeDBSnapshotsCommand(params));

    // Only add rds backup snapshots that are a week old or month old to avoid adding snapshots created same day
    if (DBSnapshots && DBSnapshots.length > 0) {
      console.log(`There are ${DBSnapshots.length} RDS db snapshots`);
      const filteredSnapshots: DBSnapshot[] = [];

      if (backupFrequency === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7); //Subtract 7 to get the date from a week ago

        filteredSnapshots.push(
          ...DBSnapshots.filter((snapshot) => {
            if (!snapshot.SnapshotCreateTime) {
              throw new Error(
                `Snapshot creation time for ${snapshot} is null or undefined`
              );
            }
            return new Date(snapshot.SnapshotCreateTime) <= weekAgo;
          })
        );
      } else if (backupFrequency === 'monthly') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1); //Get start of month because this runs on the 1st of every month

        filteredSnapshots.push(
          ...DBSnapshots.filter((snapshot) => {
            if (!snapshot.SnapshotCreateTime) {
              throw new Error(
                `Snapshot creation time for ${snapshot} is null or undefined`
              );
            }
            return new Date(snapshot.SnapshotCreateTime) < monthAgo;
          })
        );
      }

      backupSnapshots.push(...filteredSnapshots);
    }
    marker = Marker;
  } while (marker);

  return backupSnapshots;
}

async function storeSnapshots(
  backupSnapshots: DBSnapshot[],
  schedulerState: SchedulerState
) {
  console.log('About to start the rds snapshot storage jobs');

  // Create date for folder structure (can be updated based on how we want the date's format to appear)
  const date = new Date();

  const currentDate = `${
    date.getMonth() + 1
  }-${date.getDate()}-${date.getFullYear()}`; // "3-20-2024"

  let storedSnapshotResponses: StartExportTaskCommandOutput[] = [];

  for (const snapshot of backupSnapshots) {
    const dbId = checkUndefinedValue(snapshot.DBInstanceIdentifier);
    const snapshotArn = checkUndefinedValue(snapshot.DBSnapshotArn);

    // Create filter params for the startExportTask command
    const params: StartExportTaskCommandInput = {
      ExportTaskIdentifier: `${dbId}-backup-export-${currentDate}`,
      IamRoleArn: rdsIamRole,
      KmsKeyId: rdsKmsKeyId,
      S3BucketName: coldStorageBucketName,
      S3Prefix: `${currentDate}/rds-backups`,
      SourceArn: snapshotArn,
    };

    // Call the RDS Start Export Task command to start exporting the rds backup snapshots to S3
    const response: StartExportTaskCommandOutput = await rdsClient.send(
      new StartExportTaskCommand(params)
    );

    storedSnapshotResponses.push(response);
  }

  //Set scheduler state enabled to 'true' if 'storedSnapshotResponses' is not empty
  schedulerState.snapshots = storedSnapshotResponses.length > 0;

  console.log(`RDS Backup Snapshot's store image to S3 jobs have begun`);
  console.log(
    'List of RDS snapshot backup S3 store information: ',
    storedSnapshotResponses
  );
  return storedSnapshotResponses;
}

async function putRdsTaskIdsInDynamo(
  storedSnapshotResponses: StartExportTaskCommandOutput[]
) {
  console.log(
    `About to put the backup rds snapshot task IDs in the ${rdsSnapshotIdTableName} dynamoDB table`
  );

  const putRequests = storedSnapshotResponses.map((response) => {
    response.ExportTaskIdentifier = checkUndefinedValue(
      response.ExportTaskIdentifier
    );
    response.SourceArn = checkUndefinedValue(response.SourceArn);
    return {
      PutRequest: {
        Item: {
          ExportTaskId: {
            S: response.ExportTaskIdentifier,
          },
          SourceArn: {
            S: response.SourceArn,
          },
        },
      },
    };
  });

  const batchWriteRequest: BatchWriteItemCommandInput = {
    RequestItems: {
      [rdsSnapshotIdTableName]: putRequests,
    },
  };

  const batchWriteResponse: BatchWriteItemCommandOutput =
    await dynamoClient.send(new BatchWriteItemCommand(batchWriteRequest));
  console.log('Batch write response: ', batchWriteResponse);

  console.log(
    `Added backup snapshot task IDs to the ${rdsSnapshotIdTableName} dynamoDB table`
  );
}

async function createSchedulerSchedule() {
  console.log('Creating hourly task checker scheduler');
  const params: CreateScheduleCommandInput = {
    Name: taskCheckerSchedulerName,
    Description: `Scheduler service to kick off the ${backupFrequency} rds cold storage backup snapshot task checker lambda`,
    FlexibleTimeWindow: {
      Mode: 'OFF',
    },
    ScheduleExpression: 'rate(1 hours)',
    State: 'ENABLED',
    Target: {
      Arn: taskCheckerLambdaArn,
      RoleArn: taskCheckerRoleArn,
    },
  };
  const response = await schedulerClient.send(
    new CreateScheduleCommand(params)
  );
  console.log('Scheduler creation response: ', response);
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
                  text: '🚨 Aws Backup RDS Cold Storage Process Has Failed Tasks',
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

export const handler: Handler = async () => {
  try {
    console.log(
      `${backupFrequency.toUpperCase()} cold storage process has started`
    );
    const successResponse: SuccessResponse = {
      statusCode: 200,
      body: {
        message: [],
      },
    };

    const createScheduler: SchedulerState = {
      snapshots: false,
    };

    //Get AwsBackup AMIs
    const backupSnapshots = await getRdsSnapshots();

    if (backupSnapshots.length > 0) {
      // Starts the process of storing the backup backup rds snapshots in s3
      const exportResponses = await storeSnapshots(
        backupSnapshots,
        createScheduler
      );

      // Put the backup AMI IDs in Dynamo to check cold storage job progress
      await putRdsTaskIdsInDynamo(exportResponses);

      console.log('Create scheduler values: ', createScheduler);

      // If the scheduler state is set to 'true' for snapshots then create the hourly task checker scheduler
      if (createScheduler.snapshots) {
        await createSchedulerSchedule();
      }

      successResponse.body.message.push(
        `Cold storage jobs for RDS Backup snapshots have been started successfully`
      );
    } else {
      successResponse.body.message.push(
        `No ${backupFrequency} RDS Backup snapshots found`
      );
    }

    console.log(successResponse);
    return successResponse;
  } catch (error) {
    console.error('Error running RDS cold storage lambda process', error);
    await sendTeamsNotification([
      `Error running rds cold storage lambda process ${error}`,
    ]);
    throw error;
  }
};
