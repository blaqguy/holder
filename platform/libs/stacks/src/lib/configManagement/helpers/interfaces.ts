import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { RemoteStack, StackConfig } from "../../stacks";

export interface DfAnsibleStateManagerAssociationConfig {
    stackName: string;
    stackConfig: StackConfig;
    disableNewRelic?: 'true' | 'false';
  }

export interface createAnsibleAssociationLambdasConfig {
    stackconfig: StackConfig;
    scope: RemoteStack;
    dftRegion: string;
    provider: AwsProvider;
    webhookUrl: string;
    associationId: string;
    associationName: string;
    ansibleAssetS3BucketArn: string;
    ansibleAssetS3BucketId: string;
}