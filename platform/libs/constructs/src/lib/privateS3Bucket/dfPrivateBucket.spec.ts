import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { S3BucketPublicAccessBlock } from '@cdktf/provider-aws/lib/s3-bucket-public-access-block';
import { Testing } from 'cdktf';
import 'cdktf/lib/testing/adapters/jest';
import { DfPrivateBucketConstruct } from './dfPrivateBucket';

describe('Private S3 Bucket', () => {
  it('\r\nShould create versioning, mfa_delete, \r\nand the bucket named correctly', () => {
    const synthedMockStack = Testing.synthScope((mockStack) => {
      // Create some object that is synth'able
      new DfPrivateBucketConstruct(mockStack, 'dfPrivateBucket', {
        bucketName: 'dfPrivateBucket',
        keyProps: {
          name: 'privateBucket',
          description: 'Description',
        },
      });
    });
    const parsedJson = JSON.parse(synthedMockStack);
    const bucketJson = parsedJson['resource'][S3Bucket.tfResourceType];
    // We do this line because the token of the resource is appended to the key in the JSON so we don't know that
    const bucketKey = Object.keys(bucketJson)[0];
    expect(bucketJson[bucketKey]).toMatchObject({
      server_side_encryption_configuration: {
        rule: {
          apply_server_side_encryption_by_default: {
            sse_algorithm: 'aws:kms',
          },
        },
      },
    });
    expect(synthedMockStack).toHaveResourceWithProperties(S3Bucket, {
      bucket: 'dfPrivateBucket',
      versioning: {
        enabled: true,
        mfa_delete: false,
      },
    });

    expect(synthedMockStack).toHaveResourceWithProperties(
      S3BucketPublicAccessBlock,
      {
        block_public_acls: true,
        block_public_policy: true,
        ignore_public_acls: true,
        restrict_public_buckets: true,
      }
    );
  });
});
