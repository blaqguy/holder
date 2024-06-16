import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
} from '@aws-sdk/client-dynamodb';
import { EventBridgeEvent, Handler } from 'aws-lambda';
import { EC2Client, StopInstancesCommand } from '@aws-sdk/client-ec2';

interface Detail {
  'instance-id': string;
}

const dynamoTableName = process.env.dynamodbTableName!;

const dynamoClient = new DynamoDBClient({});
const ec2Client = new EC2Client({});

export const handler: Handler = async (
  event: EventBridgeEvent<'EC2 State Manager Association State Change', Detail>
) => {
  const instanceId = event.detail['instance-id'];
  try {
    // Check if instance in DynamoDB tracking trable
    const input = {
      TableName: dynamoTableName,
      Key: {
        InstanceId: { S: instanceId },
      },
    };

    const command = new GetItemCommand(input);

    const response: GetItemCommandOutput = await dynamoClient.send(command);

    // If instance is found, stop instance and delete it from the table
    if (response.Item) {
      console.log(`Match found for ${instanceId}, stopping and deleting`);

      // Stop the instance
      await ec2Client.send(
        new StopInstancesCommand({ InstanceIds: [instanceId] })
      );

      console.log(`Stopped ${instanceId}`)

      // Delete the instance from DynamoDB
      await dynamoClient.send(new DeleteItemCommand(input))
      
      console.log(`Delete ${instanceId} from the DynamoDB Table`)
    } else {
      console.log(`No match found for ${instanceId} - No action to perform.... ending`)
    }

    return {
      statusCode: 200,
      body: 'Success',
    };
  } catch (error) {
    console.error('Error running handler', error);
    throw error;
  }
};
