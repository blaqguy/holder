import { Handler } from 'aws-lambda';
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
  CreateStoreImageTaskCommand,
  DescribeImagesCommand,
  DescribeImagesCommandOutput,
  EC2Client,
  Image,
  CopySnapshotCommand,
  CopySnapshotCommandInput,
  CopySnapshotCommandOutput,
} from '@aws-sdk/client-ec2';
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
  imageIdTableName: string;
  snapshotIdTableName: string;
  backupFrequency: string;
  coldStorageBucketName: string;
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
  amis: boolean;
  snapshots: boolean;
}

const {
  imageIdTableName,
  snapshotIdTableName,
  backupFrequency,
  coldStorageBucketName,
  taskCheckerSchedulerName,
  taskCheckerLambdaArn,
  taskCheckerRoleArn,
  webhookUrl,
  accountName,
} = checkUndefined({
  imageIdTableName: process.env.imageIdTableName,
  snapshotIdTableName: process.env.snapshotIdTableName,
  backupFrequency: process.env.backupFrequency,
  coldStorageBucketName: process.env.coldStorageBucketName,
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

const dynamoClient = new DynamoDBClient({});
const ec2Client = new EC2Client({});
const schedulerClient = new SchedulerClient({});

async function getbackupImages() {
  const backupImages: Image[] = [];
  let nextToken: string | undefined;

  do {
    // Create filter params for the describeImage command
    const params = {
      Filters: [
        {
          Name: 'name',
          Values: ['*AwsBackup*'],
        },
        {
          Name: 'tag:aws:backup:source-resource',
          Values: ['*i-*'],
        },
        {
          Name: `tag:backupFrequency`,
          Values: [backupFrequency],
        },
      ],
      NextToken: nextToken,
    };

    // Call the EC2 Describe Images command to get list of AMI Images from AWS Backup
    const { Images, NextToken }: DescribeImagesCommandOutput =
      await ec2Client.send(new DescribeImagesCommand(params));

    // Only add images that are a week old or month old and not new images that have been created same day
    if (Images && Images.length > 0) {
      const filteredImages: Image[] = [];

      if (backupFrequency === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7); //Subtract 7 to get the date from a week ago

        filteredImages.push(
          ...Images.filter((image) => {
            image.CreationDate = checkUndefinedValue(image.CreationDate);
            return new Date(image.CreationDate) <= weekAgo;
          })
        );
      } else if (backupFrequency === 'monthly') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1); //Get start of month because this runs on the 1st of every month

        filteredImages.push(
          ...Images.filter((image) => {
            image.CreationDate = checkUndefinedValue(image.CreationDate);
            return new Date(image.CreationDate) < monthAgo;
          })
        );
      }

      backupImages.push(...filteredImages);
    }
    nextToken = NextToken;
  } while (nextToken);

  return backupImages;
}

async function storeAmis(
  backupImages: Image[],
  schedulerState: SchedulerState
) {
  console.log('About to start the ami storage jobs');

  // Create date for folder structure (can be updated based on how we want the date's format to appear)
  const date = new Date();

  const currentDate = `${
    date.getMonth() + 1
  }-${date.getDate()}-${date.getFullYear()}`; // "3-20-2024"

  // Loop through the AMI ids list to store each AMI
  let storedAmiObjects: {
    bucket: string;
    filePath: string;
    amiId: string | undefined;
  }[] = [];
  for (const image of backupImages) {
    // Get EC2 instance ID from image name
    const instanceId = image.Name?.split('_')[1]; // image name looks like -> "AwsBackup_i-1234567890_43D2A8E8-FDDF-C7B5"

    // Create filter params for the describeImage command
    const params = {
      ImageId: image.ImageId,
      Bucket: `${coldStorageBucketName}/${currentDate}/ami-backups/${instanceId}`,
      S3ObjectTags: [
        {
          Key: `AwsBackupName`,
          Value: image.Name,
        },
        {
          Key: `AwsInstanceId`,
          Value: instanceId,
        },
        {
          Key: `AwsBackupAmiId`,
          Value: `${image.ImageId}`,
        },
      ],
    };

    // Call the EC2 Describe Images command to get list of AMI Images from AWS Backup
    await ec2Client.send(new CreateStoreImageTaskCommand(params));

    const storeObj = {
      bucket: coldStorageBucketName,
      filePath: `/${currentDate}/ami-backups/${instanceId}`,
      amiId: image.ImageId,
    };

    storedAmiObjects.push(storeObj);
  }

  //Set scheduler state enabled to 'true' if 'storedAmiObjects' is not empty
  schedulerState.amis = storedAmiObjects.length > 0;

  console.log(`EC2 Backup AMI's store image jobs have begun`);
  console.log('List of AMI backup S3 store information: ', storedAmiObjects);
}

async function putAmiIdsInDynamo(backupImages: Image[]) {
  console.log(
    `About to put the backup images ami IDs in the ${imageIdTableName} dynamoDB table`
  );

  const putRequests = backupImages.map((image) => {
    image.ImageId = checkUndefinedValue(image.ImageId);
    return {
      PutRequest: {
        Item: {
          ImageId: {
            S: image.ImageId,
          },
        },
      },
    };
  });
  // Loop through backupImages and add ImageIds as the stored items
  const batchWriteRequest: BatchWriteItemCommandInput = {
    RequestItems: {
      [imageIdTableName]: putRequests,
    },
  };

  const batchWriteResponse: BatchWriteItemCommandOutput =
    await dynamoClient.send(new BatchWriteItemCommand(batchWriteRequest));
  console.log('Batch write response: ', batchWriteResponse);

  console.log(
    `Added backup Image IDs to the ${imageIdTableName} dynamoDB table`
  );
}

async function copyEbsSnapshots(
  backupImages: Image[] = [],
  schedulerState: SchedulerState
) {
  console.log('Beginning to copy EC2 Backup EBS volume snapshots');

  let copiedSnapshotIds: string[] = [];
  for (const image of backupImages) {
    // First grab the list of block devices to make copies
    if (image.BlockDeviceMappings && image.BlockDeviceMappings.length > 0) {
      for (const blockDevice of image.BlockDeviceMappings) {
        // Make a copy of the snapshots because aws backup snapshots can not be set to archive tier
        const copyParams: CopySnapshotCommandInput = {
          DestinationRegion: process.env.AWS_REGION,
          SourceRegion: process.env.AWS_REGION,
          SourceSnapshotId: blockDevice.Ebs?.SnapshotId,
          Description: `Archived cold storage backup of ${blockDevice.Ebs?.SnapshotId} from ${process.env.AWS_REGION} for ${image.ImageId}`,
          TagSpecifications: [
            {
              ResourceType: 'snapshot',
              Tags: [
                {
                  Key: `AwsBackupName`,
                  Value: image.Name,
                },
                {
                  Key: `AwsSourceSnapshotId`,
                  Value: blockDevice.Ebs?.SnapshotId,
                },
                {
                  Key: `AwsBackupAmiId`,
                  Value: `${image.ImageId}`,
                },
              ],
            },
          ],
        };
        const copyResponse: CopySnapshotCommandOutput = await ec2Client.send(
          new CopySnapshotCommand(copyParams)
        );
        console.log('Response from copy command: ', copyResponse);
        if (copyResponse.SnapshotId) {
          copiedSnapshotIds.push(copyResponse.SnapshotId);
        }
      }
    } else {
      throw new Error(
        `Either BlockDeviceMappings is undefined or is empty for image ${image.ImageId}`
      );
    }
  }

  //Set scheduler state enabled to 'true' if 'storedAmiObjects' is not empty
  schedulerState.snapshots = copiedSnapshotIds.length > 0;

  console.log('EC2 Backup EBS volume snapshot copy jobs have been started');
  return copiedSnapshotIds;
}

async function storeSnapshotIdsInDynamo(snapshotIds: string[]) {
  console.log(
    `About to put the copied backup snaphsot IDs into the ${snapshotIdTableName} dynamoDB table`
  );

  // Loop through backupImages and add ImageIds as the stored items
  const batchWriteRequest: BatchWriteItemCommandInput = {
    RequestItems: {
      [snapshotIdTableName]: snapshotIds.map((snapshotId) => ({
        PutRequest: {
          Item: {
            SnapshotId: {
              S: snapshotId,
            },
            Status: {
              S: 'copying',
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
    `Added copied backup snapshot IDs to the ${snapshotIdTableName} dynamoDB table`
  );
}

async function createSchedulerSchedule() {
  console.log('Creating hourly task checker scheduler');
  const params: CreateScheduleCommandInput = {
    Name: taskCheckerSchedulerName,
    Description: `Scheduler service to kick off the ${backupFrequency} ec2 cold storage backup AMI & snapshot task checker lambda`,
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
                  text: '🚨 Aws Backup EC2 Cold Storage Process Has Failed Tasks',
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
    const response = await axios.post(webhookUrl, teamsCard);
    console.log('Response from sending teams channel notification', response);
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
      amis: false,
      snapshots: false,
    };

    //Get AwsBackup AMIs
    const backupImages = await getbackupImages();

    if (backupImages.length > 0) {
      // Starts the process of storing the backup AMI ids in s3
      await storeAmis(backupImages, createScheduler);

      // Put the backup AMI IDs in Dynamo to check cold storage job progress
      await putAmiIdsInDynamo(backupImages);

      // Starts the process of copying existing backup ebs snapshots
      const copiedSnapshotIds = await copyEbsSnapshots(
        backupImages,
        createScheduler
      );

      // Store copied snapshot IDs in Dynamo to check copy job progress
      await storeSnapshotIdsInDynamo(copiedSnapshotIds);

      console.log('Create scheduler values: ', createScheduler);

      // If the scheduler state is set to 'true' for either amis or snapshots then create the hourly task checker scheduler
      if (createScheduler.amis || createScheduler.snapshots) {
        await createSchedulerSchedule();
      }

      successResponse.body.message.push(
        `Cold storage jobs for EC2 Backup AMI's and EBS snapshots have been started successfully`
      );
    } else {
      successResponse.body.message.push('No EC2 Backup AMIs found');
    }

    console.log(successResponse);
    return successResponse;
  } catch (error) {
    console.error('Error running ec2 cold storage lambda process', error);
    await sendTeamsNotification([
      `Error running ec2 cold storage lambda process ${error}`,
    ]);
    throw error;
  }
};
