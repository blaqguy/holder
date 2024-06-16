import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster';
import { EcsClusterCapacityProviders } from '@cdktf/provider-aws/lib/ecs-cluster-capacity-providers';
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service';
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition';
import { IamPolicy } from '@cdktf/provider-aws/lib/iam-policy';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { KmsKey } from '@cdktf/provider-aws/lib/kms-key';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import { AssetType, Fn, TerraformAsset } from 'cdktf';
import path = require('path');
import { DfJenkinsStack } from './dfJenkinsStack';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import { file as FileResource } from '@cdktf/provider-local';
import { provider as LocalProvider } from '@cdktf/provider-local';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import { password as JenkinsPassword } from '@cdktf/provider-random';
import { Asg } from '@dragonfly/generated';
import { DataAwsSsmParameter } from '@cdktf/provider-aws/lib/data-aws-ssm-parameter';
import { Constants, DfAccounts, Utils } from '@dragonfly/utils';
import { EcsCapacityProvider } from '@cdktf/provider-aws/lib/ecs-capacity-provider';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

/**
 * Jenkins resources
 * @param {DfJenkinsStack} stack - Jenkins stack
 * @param {AwsProvider} provider - Provider
 * @param {string} federatedAccountId - Account ID of target account
 * @param {string} prefix - prefix
 */
export function createResources(
  stack: DfJenkinsStack,
  provider: AwsProvider,
  federatedAccountId: string,
  prefix?: string,
) {
  const currRegion = new DataAwsRegion(stack, 'currRegion', {
    provider: provider,
  });

  const jenkinsCloudWatchKmsKey = new KmsKey(stack, 'jenkinsCloudWatchKmsKey', {
    provider: provider,
    description: 'jenkinsCloudWatchKmsKey',
    enableKeyRotation: true,
    deletionWindowInDays: 7,
    tags: {
      Name: 'jenkins-cloudwatch-key',
    },
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Enable IAM User Permissions',
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${stack.federatedAccountId}:root`,
          },
          Action: 'kms:*',
          Resource: '*',
        },
        {
          Sid: 'Allow CloudWatch',
          Effect: 'Allow',
          Principal: {
            Service: [`logs.${currRegion.name}.amazonaws.com`],
          },
          Action: [
            'kms:Encrypt*',
            'kms:Decrypt*',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:Describe*',
          ],
          Resource: '*',
        },
      ],
    }),
  });

  /**
   * Master configuration
   */

  const jenkinsMasterEcsCluster = new EcsCluster(
    stack,
    'jenkinsMasterEcsCluster',
    {
      provider: provider,
      name: 'jenkinsMasterEcsCluster',
      tags: {
        Name: 'jenkins-master-ecs-cluster',
      },
      setting: [
        {
          name: 'containerInsights',
          value: 'enabled',
        },
      ],
    },
  );

  new EcsClusterCapacityProviders(stack, 'jenkinsNonSpotProvider', {
    provider: provider,
    clusterName: jenkinsMasterEcsCluster.name,
    capacityProviders: ['FARGATE'],
  });

  const jenkinsMasterLogGroup = new CloudwatchLogGroup(
    stack,
    'jenkinsMasterLogGroup',
    {
      provider: provider,
      name: 'jenkinsMaster',
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        federatedAccountId,
      )
        ? 365
        : 30,
      tags: {
        Name: 'jenkins-master',
      },
      kmsKeyId: jenkinsCloudWatchKmsKey.arn,
    },
  );

  /**
   * Agent configuration
   */

  const windowsAgentAmi = new DataAwsSsmParameter(
    stack,
    Utils.createStackResourceId(stack.getStackUuid, 'ecsAmiLookup'),
    {
      provider: provider,
      name: '/aws/service/ami-windows-latest/Windows_Server-2019-English-Core-ECS_Optimized',
    },
  );

  const windowsAgentAsg = new Asg(stack, 'jenkinsWindowsAgentAsg', {
    providers: provider ? [provider] : null,
    name: 'jenkins-windows-agent',
    minSize: 1,
    maxSize: 1,
    desiredCapacity: 1,
    healthCheckType: 'EC2',
    vpcZoneIdentifier: stack.jenkinsStackConfig.spokeVpc.appSubnetIds,
    autoscalingGroupTags: {
      AmazonEcsManaged: 'true',
      os: 'windows',
    },
    launchTemplateName: 'jenkins-windows-agent',
    launchTemplateDescription: 'jenkins windows agent',
    updateDefaultVersion: 'true',
    imageId: Fn.lookup(Fn.jsondecode(windowsAgentAmi.value), 'image_id', ''),
    instanceType:
      federatedAccountId ===
      DfAccounts.getPlatformSandboxAccountDef().accountNumber
        ? 't3.medium'
        : 'm4.xlarge',
    enableMonitoring: true,
    createIamInstanceProfile: true,
    iamRoleName: 'jenkins-windows-agent',
    iamRoleDescription: 'jenkins windows agent',
    ignoreDesiredCapacityChanges: true,
    iamRolePolicies: {
      AmazonEC2ContainerServiceforEC2Role:
        'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role',
      AmazonSSMManagedInstanceCore:
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
    },
    protectFromScaleIn: true,
    userData: Fn.base64encode(`
      <powershell>
      Import-Module ECSTools
      Initialize-ECSAgent -Cluster jenkinsAgents -EnableTaskIAMRole -EnableTaskENI -AwsvpcBlockIMDS 
      </powershell>
      `),
  });

  const windowsCapacityProvider = new EcsCapacityProvider(
    stack,
    'windows-agent-capacity-provider',
    {
      provider: provider,
      name: 'windows-agent',
      autoScalingGroupProvider: {
        autoScalingGroupArn: windowsAgentAsg.autoscalingGroupArnOutput,
        managedScaling: {
          maximumScalingStepSize: 1,
          minimumScalingStepSize: 1,
          status: 'ENABLED',
          targetCapacity: 60,
        },
      },
      tags: { Name: 'windows-agent' },
    },
  );

  const jenkinsAgentsEcsCluster = new EcsCluster(
    stack,
    'jenkinsAgentsEcsCluster',
    {
      provider: provider,
      name: 'jenkinsAgents',
      tags: {
        Name: 'jenkins-agents',
      },
      setting: [
        {
          name: 'containerInsights',
          value: 'enabled',
        },
      ],
    },
  );

  new EcsClusterCapacityProviders(stack, 'jenkinsClusterCapacityProvider', {
    clusterName: jenkinsAgentsEcsCluster.name,
    capacityProviders: [windowsCapacityProvider.name],
  });

  const agentLogGroup = new CloudwatchLogGroup(
    stack,
    'jenkinsAgentCloudWatchLogGroup',
    {
      provider: provider,
      name: 'jenkinsAgents',
      retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
        federatedAccountId,
      )
        ? 365
        : 30,
      tags: {
        Name: 'jenkins-agents',
      },
      kmsKeyId: jenkinsCloudWatchKmsKey.arn,
    },
  );

  /**
   * IAM configuration
   */

  const jenkinsEcsTaskRolePolicy = new IamPolicy(stack, 'JenkinsMasterPolicy', {
    provider: provider,
    name: `JenkinsMasterPolicy${prefix ? `-${prefix}` : ''}`,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: ['ecs:ListContainerInstances'],
          Resource: [jenkinsMasterEcsCluster.arn, jenkinsAgentsEcsCluster.arn],
          Effect: 'Allow',
        },
        {
          Effect: 'Allow',
          Resource: [
            `arn:aws:ecs:${currRegion.name}:${stack.federatedAccountId}:task-definition/*`,
          ],
          Action: ['ecs:RunTask'],
          Condition: {
            ArnEquals: {
              'ecs:cluster': [
                jenkinsMasterEcsCluster.arn,
                jenkinsAgentsEcsCluster.arn,
              ],
            },
          },
        },
        {
          Effect: 'Allow',
          Resource: [
            `arn:aws:ecs:${currRegion.name}:${stack.federatedAccountId}:task/*`,
          ],
          Action: ['ecs:StopTask', 'ecs:DescribeTasks'],
          Condition: {
            ArnEquals: {
              'ecs:cluster': [
                jenkinsMasterEcsCluster.arn,
                jenkinsAgentsEcsCluster.arn,
              ],
            },
          },
        },
        {
          Effect: 'Allow',
          Action: ['ssm:PutParameter', 'ssm:GetParameter', 'ssm:GetParameters'],
          Resource: [
            `arn:aws:ssm:${currRegion.name}:${stack.federatedAccountId}:parameter/jenkins*`,
          ],
        },
        {
          Effect: 'Allow',
          Action: ['kms:Decrypt'],
          Resource: [
            `arn:aws:kms:${currRegion.name}:${stack.federatedAccountId}:alias/aws/ssm`,
          ],
        },
        {
          Effect: 'Allow',
          Action: ['iam:PassRole'],
          Resource: [`arn:aws:iam::${stack.federatedAccountId}:role/*`],
        },
        {
          Effect: 'Allow',
          Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: [`${jenkinsMasterLogGroup.arn}:*`],
        },
        {
          Effect: 'Allow',
          Action: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchGetImage',
            'ecr:GetDownloadUrlForLayer',
            'elasticfilesystem:ClientMount',
            'ecr:GetAuthorizationToken',
            'ecs:RegisterTaskDefinition',
            'ecs:ListClusters',
            'ecs:DescribeContainerInstances',
            'ecs:ListTaskDefinitions',
            'ecs:DescribeTaskDefinition',
            'ecs:DeregisterTaskDefinition',
            'ecs:ListTagsForResource',
          ],
          Resource: ['*'],
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticfilesystem:ClientWrite',
            'elasticfilesystem:ClientRootAccess',
          ],
          Resource: [stack.jenkinsEfs.efsArn],
        },
      ],
    }),
    tags: {
      Name: prefix
        ? `jenkins-master-policy-${prefix}`
        : 'jenkins-master-policy',
    },
  });

  const jenkinsEcsTaskRole = new IamRole(stack, `jenkinsEcsTaskRole`, {
    provider: provider,
    name: `JenkinsMasterTaskRole${prefix ? `-${prefix}` : ''}`,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
          Effect: 'Allow',
        },
      ],
    }),
    tags: {
      Name: prefix
        ? `jenkins-master-task-role-${prefix}`
        : 'jenkins-master-task-role',
    },
  });

  new IamRolePolicyAttachment(stack, 'JenkinsMasterTaskRoleAttachment', {
    provider: provider,
    policyArn: jenkinsEcsTaskRolePolicy.arn,
    role: jenkinsEcsTaskRole.name,
  });

  const jenkinsEcsExecutionIamRole = new IamRole(
    stack,
    `jenkinsEcsExecutionIamRole`,
    {
      provider: provider,
      name: `jenkinsEcsExecutionIamRole${prefix ? `-${prefix}` : ''}`,
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
            Effect: 'Allow',
          },
        ],
      }),
      tags: {
        Name: prefix
          ? `jenkins-ecs-execution-role-${prefix}`
          : 'jenkins-ecs-execution-role',
      },
    },
  );

  const jenkinsEcsExecutionIamPolicy = new IamPolicy(
    stack,
    `jenkinsEcsExecutionIamPolicy`,
    {
      provider: provider,
      name: `jenkinsEcsExecutionIamPolicy${prefix ? `-${prefix}` : ''}`,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: [
              'ecr:GetAuthorizationToken',
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
              'logs:CreateLogStream',
              'logs:CreateLogGroup',
              'logs:PutLogEvents',
            ],
            Resource: '*',
            Effect: 'Allow',
          },
        ],
      }),
      lifecycle: {
        createBeforeDestroy: true,
      },
      tags: {
        Name: prefix
          ? `jenkins-ecs-execution-policy-${prefix}`
          : 'jenkins-ecs-execution-policy',
      },
    },
  );

  new IamRolePolicyAttachment(
    stack,
    'JenkinsEcsExecutionRolePolicyAttachment',
    {
      provider: provider,
      policyArn: jenkinsEcsExecutionIamPolicy.arn,
      role: jenkinsEcsExecutionIamRole.name,
    },
  );

  /**
   * ECS configuration
   */

  const jenkinsMasterTaskDefinition = new EcsTaskDefinition(
    stack,
    'JenkinsMasterTaskDefinition',
    {
      provider: provider,
      family: 'jenkinsMasterTaskDefinition',
      taskRoleArn: jenkinsEcsTaskRole.arn,
      executionRoleArn: jenkinsEcsExecutionIamRole.arn,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '2048',
      memory: '4096',
      volume: [
        {
          name: 'jenkinsHome',
          efsVolumeConfiguration: {
            fileSystemId: stack.jenkinsEfs.efsId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: stack.efsAccessPoint.id,
              iam: 'ENABLED',
            },
          },
        },
      ],
      // TODO: This can be a templated file
      containerDefinitions: JSON.stringify([
        {
          name: 'jenkinsMaster',
          image: `${stack.jenkinsEcr.repoUrl}:latest`,
          cpu: 2048,
          memory: 4096,
          memoryReservation: 4096,
          environment: [
            {
              name: 'JAVA_OPTS',
              value: '-Djenkins.install.runSetupWizard=false',
            },
          ],
          essential: true,
          mountPoints: [
            {
              sourceVolume: 'jenkinsHome',
              containerPath: '/var/jenkins_home',
            },
          ],
          portMappings: [
            {
              containerPort: 8080,
            },
            {
              containerPort: 9999,
            },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': jenkinsMasterLogGroup.name,
              'awslogs-region': currRegion.name,
              'awslogs-stream-prefix': 'jenkinsMaster',
            },
          },
        },
      ]),
      tags: {
        Name: 'jenkins-master-task-definition',
      },
    },
  );

  new EcsService(stack, 'JenkinsMasterService', {
    provider: provider,
    name: 'jenkinsMasterService',
    cluster: jenkinsMasterEcsCluster.id,
    desiredCount: 1,
    launchType: 'FARGATE',
    taskDefinition: jenkinsMasterTaskDefinition.arn,
    networkConfiguration: {
      subnets: stack.jenkinsStackConfig.spokeVpc.appSubnetIds,
      assignPublicIp: false,
      securityGroups: [stack.jenkinsSecurityGroups.master.id],
    },
    loadBalancer: [
      {
        containerPort: 8080,
        containerName: 'jenkinsMaster',
        targetGroupArn: stack.jenkinsStackConfig.targetGroupArn,
      },
    ],
    healthCheckGracePeriodSeconds: 300,
    tags: { Name: 'jenkins-master-service' },
  });

  /**
   * Build process
   */

  const jenkinsAssets = new TerraformAsset(stack, 'JenkinsYAML', {
    path: path.resolve(__dirname, 'docker/jenkins'),
    type: AssetType.DIRECTORY,
  });

  // generate 15 character random string
  // TODO: Replace this with random TF

  const jenkinsPassword = new JenkinsPassword.Password(
    stack,
    'jenkinsPassword',
    {
      length: 16,
      special: false,
    },
  );

  new SsmParameter(stack, 'JenkinsPassword', {
    provider: provider,
    name: 'jenkinsPassword',
    type: 'SecureString',
    value: jenkinsPassword.result,
    description: 'Jenkins Master Password',
    tags: { Name: 'jenkins-password' },
  });

  const sopsData = Utils.getSecretsForNode(stack.node);

  const template = Fn.templatefile(
    `${jenkinsAssets.path}/files/jenkins.yaml.tftpl`,
    {
      admin_password: jenkinsPassword.result,
      agent_port: 9999,
      ecs_agent_cluster: jenkinsAgentsEcsCluster.arn,
      aws_default_region: currRegion.name,
      jenkins_url: stack.domainName,
      agent_security_group: stack.jenkinsSecurityGroups.master.id,
      subnet0: stack.jenkinsStackConfig.spokeVpc.appSubnetIds[0],
      subnet1: stack.jenkinsStackConfig.spokeVpc.appSubnetIds[1],
      subnet2: stack.jenkinsStackConfig.spokeVpc.appSubnetIds[2],
      log_group: agentLogGroup.name,
      sso_tenant: sopsData.JENKINS_SSO.tenant,
      sso_client_id: sopsData.JENKINS_SSO.clientId,
      sso_client_secret: sopsData.JENKINS_SSO.clientSecret,
    },
  );

  new LocalProvider.LocalProvider(stack, 'JenkinsYamlLocalProvider');

  const renderedTemplate = new FileResource.File(stack, 'JenkinsYaml', {
    content: template,
    filename: `${jenkinsAssets.path}/files/jenkins.yaml`,
  });

  new NullProvider(stack, 'NullProvider');

  if (process.env.DOCKER_BUILDS_ENABLED === 'true') {
    new Resource(stack, 'buildAndPush', {
      // provider: provider,
      triggers: {
        src_hash: Fn.file(`${jenkinsAssets.path}/files/jenkins.yaml.tftpl`),
        foo: 'baz',
      },

      dependsOn: [renderedTemplate],

      provisioners: [
        {
          type: 'local-exec',
          workingDir: jenkinsAssets.path,
          command: `
         ${stack.jenkinsStackConfig.dockerPushRoleAssumption}
         cat 'files/jenkins.yaml' &&
         aws sts get-caller-identity
         aws ecr get-login-password --region ${currRegion.name} |
         docker login --username AWS --password-stdin ${stack.jenkinsEcr.repoUrl} &&
         docker buildx build --platform=linux/amd64 -t ${stack.jenkinsEcr.repoUrl}:latest . --no-cache &&
         docker push ${stack.jenkinsEcr.repoUrl}:latest
         `,
        },
      ],
    });
  }
}
