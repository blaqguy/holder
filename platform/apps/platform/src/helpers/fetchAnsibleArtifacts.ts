import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { Constants } from '@dragonfly/utils';
import * as fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

/**
 * Fetches Ansible artifacts from S3 and saves them locally
 */
export async function fetchAnsibleArtifacts() {
  if (process.env.USE_LOCAL_ANSIBLE_FILES) {
    // nothing - local ansible files should be imported
    console.log('Returned with no pulled ansible files');
    return;
  } else {
    const client = new STSClient({});

    const input = {
      Region: 'us-east-1',
      RoleArn: `arn:aws:iam::${Constants.ACCOUNT_NUMBER_TOOLS}:role/${Constants.ROLE_PROVISION_ROLE_NAME}`,
      DurationSeconds: 1200,
      RoleSessionName: 's3helper',
    };

    const stsReponse = await client.send(new AssumeRoleCommand(input));

    if (
      !stsReponse.Credentials ||
      !stsReponse.Credentials.AccessKeyId ||
      !stsReponse.Credentials.SecretAccessKey ||
      !stsReponse.Credentials.SessionToken
    ) {
      throw new Error('Failed to get complete credentials from STS');
    }

    const s3 = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: stsReponse.Credentials.AccessKeyId,
        secretAccessKey: stsReponse.Credentials.SecretAccessKey,
        sessionToken: stsReponse.Credentials.SessionToken,
      },
    });

    const bucketName = Constants.SELF_SERVICE_BUCKET_NAME;
    const { Contents } = await s3.send(
      new ListObjectsV2Command({ Bucket: bucketName })
    );

    if (!Contents) return;

    for (const object of Contents) {
      const { Key } = object;

      if (!Key) continue;

      // Dropping the prefix for local saving
      const localFileKey = Key.replace('ansible-templates/', '');
      const localFilePath = path.resolve(
        __dirname,
        `ansibleAssets/ansible/${localFileKey}`
      );

      if (!fs.existsSync(path.dirname(localFilePath))) {
        fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
      }

      const objectData = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key })
      );

      if (objectData.Body) {
        const writeStream = fs.createWriteStream(localFilePath);
        (objectData.Body as Readable).pipe(writeStream);
      }
    }
  }
}
