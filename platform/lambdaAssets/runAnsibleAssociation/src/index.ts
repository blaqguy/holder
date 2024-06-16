import {
  SSMClient,
  ListAssociationsCommand,
  StartAssociationsOnceCommand,
  ListAssociationsCommandOutput,
} from '@aws-sdk/client-ssm';
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { Handler } from 'aws-lambda';
import {
  DescribeInstancesCommand,
  DescribeInstancesCommandOutput,
  EC2Client,
  StartInstancesCommand,
} from '@aws-sdk/client-ec2';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import axios from 'axios';
import { dftAccountsNumbersToNameMap } from './accountNumToNameMap';

/**
 * * Get run time variables from environment variables
 * * Exclamation mark is used to tell TypeScript that the variable is not null or undefined
 */
const associationName = process.env.associationName!;
const dynamoTableName = process.env.dynamodbTableName!;
const webhookUrl = process.env.webhookUrl!;

const ssmClient = new SSMClient({});
const dynamoClient = new DynamoDBClient({});
const ec2Client = new EC2Client({});
const stsClient = new STSClient({});

async function sendTeamsMessage(message: string, accountId: string) {
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
                  text: '🚨 Systems Manager State Manager Association Apply in progress',
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
                      text: 'Message',
                      weight: 'bolder',
                    },
                  ],
                },
                {
                  type: 'Column',
                  items: [
                    {
                      type: 'TextBlock',
                      text: accountId,
                    },
                    {
                      type: 'TextBlock',
                      text: process.env.AWS_REGION,
                    },
                    {
                      type: 'TextBlock',
                      text: message,
                      wrap: 'true',
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
    console.error('Error sending Teams message', error);
    throw error;
  }
}

/**
 * * Some environment have 10s if not 100s of instances
 * * This is to ensure sane processsing of instances and smooth performance
 */
const batchSize = 25;

export const handler: Handler = async (event: any) => {
  try {
    const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));    
    const accountId = callerIdentity.Account!;
    const account = dftAccountsNumbersToNameMap[accountId] || accountId;

    // *Check if there are any items in the DynamoDB table

    const scanResponse = await dynamoClient.send(
      new ScanCommand({ TableName: dynamoTableName, Limit: 1 })
    );
    if (scanResponse.Items && scanResponse.Items.length > 0) {
      console.log('Items are present in the DynamoDB table');
      await sendTeamsMessage(
        'Association apply may already be in progress. DynamoDB Table not empty.', account
      );
      return;
    }

    /**
     * * Use Pagination to handle large number of instances
     * * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ec2/command/DescribeInstancesCommand/
     */
    let nextToken;
    do {
      const describeInstancesResponse: DescribeInstancesCommandOutput =
        await ec2Client.send(
          new DescribeInstancesCommand({
            Filters: [
              { Name: 'tag:ansible-managed', Values: ['true'] },
              { Name: 'instance-state-name', Values: ['stopped'] },
            ],
            NextToken: nextToken,
          })
        );

      const instances =
        describeInstancesResponse.Reservations?.flatMap(
          (reservation) => reservation.Instances
        ) ?? [];
      nextToken = describeInstancesResponse.NextToken;

      // Process instances in batches
      for (let i = 0; i < instances.length; i += batchSize) {
        const batchInstances = instances.slice(i, i + batchSize);
        const instanceIds = batchInstances
          .map((instance) => instance?.InstanceId)
          .filter((id): id is string => id !== undefined);

        console.log(`Processing batch of instances: ${instanceIds.join(', ')}`);

        // Add to DynamoDB and start instances in parallel
        await Promise.all([
          dynamoClient.send(
            new BatchWriteItemCommand({
              RequestItems: {
                [dynamoTableName]: instanceIds.map((instanceId) => ({
                  PutRequest: {
                    Item: { InstanceId: { S: instanceId } },
                  },
                })),
              },
            })
          ),
          ec2Client.send(
            new StartInstancesCommand({ InstanceIds: instanceIds })
          ),
        ]);
        console.log(
          `Started and added these instance to DynamoDB for tracking: ${instanceIds.join(
            ', '
          )}`
        );
      }
    } while (nextToken);

    // SSM Association Block
    const response: ListAssociationsCommandOutput = await ssmClient.send(
      new ListAssociationsCommand({
        AssociationFilterList: [
          {
            key: 'AssociationName', // Filter by association name
            value: associationName,
          },
        ],
      })
    );

    const associationIds = response.Associations!.map(
      (associationId) => associationId!.AssociationId!
    );

    // Check if we have any association IDs before triggering
    if (associationIds.length === 0) {
      console.log('No associations found');
      return {
        statusCode: 200,
        body: 'No associations found for the given association name.',
      };
    }

    // Start the associations using the retrieved association IDs
    const startAssociationsOnceCommand = new StartAssociationsOnceCommand({
      AssociationIds: associationIds,
    });

    const startResponse = await ssmClient.send(startAssociationsOnceCommand);

    console.log(
      `Start associations response: ${JSON.stringify(startResponse, null, 2)}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify(startResponse),
    };
  } catch (error) {
    console.error('Error running Ansible association', error);
    throw error;
  }
};
