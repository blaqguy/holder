import { EventBridgeEvent, Handler } from 'aws-lambda';
import axios from 'axios';
import { dftAccountsNumbersToNameMap } from './accountNumToNameMap';

interface Detail {
  'association-name': string;
  'association-status-aggregated-count': string;
}

const webhookUrl = process.env.webhookUrl!;

export const handler: Handler = async (
  event: EventBridgeEvent<'EC2 State Manager Association State Change', Detail>
) => {
  const failedAssociationName = event.detail['association-name'];

  // Find the account name from the account number
  const account = dftAccountsNumbersToNameMap[event.account] || event.account;

  const message = `${failedAssociationName} has failed. Please investigate.`;
  const teamsCard = {
    type: 'message',
    summary: 'EC2 State Manager Association Failure',
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
                  text: '🚨 Systems Manager State Manager Association Failed',
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
                      weight: 'Bolder',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Region',
                      weight: 'Bolder',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Message',
                      weight: 'Bolder',
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: account,
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
    /**
     * * The Association event keeps sending a sucess event for every reapply
     * * Before sending another event later with the real status. The real status
     * * Will always have a non empty 'association-status-aggregated-count' field
     */
    const aggregatedCount = JSON.parse(
      event.detail['association-status-aggregated-count']
    );
    console.log('Aggregated count:', aggregatedCount);
    if (Object.keys(aggregatedCount).length > 0) {
      await axios.post(webhookUrl, teamsCard);
    } else {
      console.log('Event has no aggregated count, skipping processing');
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
