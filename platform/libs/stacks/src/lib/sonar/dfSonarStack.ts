import {
  DfAliasedKeyConstruct,
  DfAuroraRdsConstruct,
  DfEcsConstruct,
  DfEfsConstruct,
  DfIamRoleConstruct,
  DfSpokeVpcConstruct,
  DfToolsVpcConstruct,
  RdsCredentials,
} from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { RdsClusterParameterGroup } from '@cdktf/provider-aws/lib/rds-cluster-parameter-group';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { Constants, PlatformSecrets, Utils } from '@dragonfly/utils';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { SecretsmanagerSecret } from '@cdktf/provider-aws/lib/secretsmanager-secret';
import { SecretsmanagerSecretVersion } from '@cdktf/provider-aws/lib/secretsmanager-secret-version';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';

export interface SonarConfig {
  vpc: DfSpokeVpcConstruct | DfToolsVpcConstruct;
  rdsCredentials: RdsCredentials;
  targetGroupArn: string;
}

/** */
export class DfSonarStack extends RemoteStack {
  private sonarConfig: SonarConfig;
  private ecs: DfEcsConstruct;

  /**
   *
   * @param {string} stackName
   * @param {StackConfig} stackConfig
   * @param {SonarConfig} sonarConfig
   */
  constructor(
    stackName: string,
    protected stackConfig: StackConfig,
    sonarConfig: SonarConfig
  ) {
    super(stackName, stackConfig);
    this.sonarConfig = sonarConfig;

    const currRegion = new DataAwsRegion(
      this,
      Utils.createStackResourceId(this.stackUuid, 'currRegion'),
      {
        provider: this.primaryProvider,
      }
    );

    const auroraDb = DfAuroraRdsConstruct.auroraPostgresRdsInstanceFactory(
      this.environment,
      this,
      stackConfig.federatedAccountId,
      `sonar-aurora-db`,
      {
        primaryProvider: this.primaryProvider,
        subnetIds: this.sonarConfig.vpc.dataSubnetIds,
        vpcResource: this.sonarConfig.vpc,
        id: 'sonar-aurora-db',
        rdsCredentials: this.sonarConfig.rdsCredentials,
        snapshotId: undefined,
        allocatedStorage: 100,
        instanceClass: 'db.r5.xlarge',
        databaseName: undefined,
        engineVersion: '14.9',
        clusterParameterGroupName: new RdsClusterParameterGroup(
          this,
          'sonar-pg',
          {
            name: 'sonar-parameter-group',
            family: 'aurora-postgresql14',
            provider: this.primaryProvider,
            tags: { Name: 'sonar-aurora-parameter-group' },
          }
        ).name,
        accountDefinition: this.stackConfig.accountDefinition,
        kmsKey: new DfAliasedKeyConstruct(this, 'sonar-aurora-db-key', {
          name: 'sonar-key-database',
          description: 'The KMS key for encypting the sonar DB',
          provider: this.primaryProvider,
        }),
        prodCustomerData: true,
      },
      this.stackConfig.accountDefinition,
      false
    );

    const sonarSg = new SecurityGroup(
      this,
      Utils.createStackResourceId(this.stackUuid, 'sonar-sg'),
      {
        provider: this.primaryProvider,
        name: 'sonar-security-group',
        vpcId: this.sonarConfig.vpc.vpcId,
        ingress: [
          {
            fromPort: 9000,
            toPort: 9000,
            protocol: 'tcp',
            cidrBlocks: ['0.0.0.0/0'],
            description: 'Allow inbound sonar traffic',
          },
        ],
        egress: [
          {
            description: 'Allow ephemeral',
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
          },
        ],
        tags: {
          Name: 'nexusSg',
        },
      }
    );

    const efs = new DfEfsConstruct(this, 'sonar-efs', {
      provider: this.primaryProvider,
      vpc: this.sonarConfig.vpc,
      forContainer: true,
      securityGroups: [sonarSg.id],
      accessPoints: [
        {
          posixUser: {
            gid: 200,
            uid: 200,
          },
          rootDirectory: {
            path: '/sonar',
            creationInfo: {
              ownerGid: 200,
              ownerUid: 200,
              permissions: '755',
            },
          },
        },
      ],
    });

    const trustDoc = new DataAwsIamPolicyDocument(this, 'MasterTrustDoc', {
      provider: this.primaryProvider,
      version: '2012-10-17',
      statement: [
        {
          sid: '',
          effect: 'Allow',
          principals: [
            { type: 'Service', identifiers: ['ecs-tasks.amazonaws.com'] },
          ],
          actions: ['sts:AssumeRole'],
        },
      ],
    });

    const permissionDoc = new DataAwsIamPolicyDocument(this, 'PermissionDoc', {
      provider: this.primaryProvider,
      version: '2012-10-17',
      statement: [
        {
          sid: '',
          effect: 'Allow',
          actions: ['kms:Decrypt'],
          resources: ['*'],
        },
        {
          sid: '',
          effect: 'Allow',
          actions: [
            'elasticfilesystem:ClientWrite',
            'elasticfilesystem:ClientRootAccess',
          ],
          resources: ['*'],
        },
      ],
    });

    const role = new DfIamRoleConstruct(this, {
      provider: this.primaryProvider,
      roleName: 'SonarQubeTaskRole',
      permissionsDocuments: [permissionDoc],
      assumptionDocument: trustDoc,
    });

    const sonarQubeLogGroup = new CloudwatchLogGroup(
      this,
      'sonar-qube-log-group',
      {
        provider: this.primaryProvider,
        name: 'sonarQubeLogGroup',
        retentionInDays: Constants.COMPLIANCE_SCOPED_ACCOUNTS.includes(
          this.stackConfig.federatedAccountId
        )
          ? 365
          : 30,
        tags: { Name: 'sonar' },
      }
    );

    const sopsData: PlatformSecrets = Utils.getSecretsForNode(this.node);
    const secretManager = new SecretsmanagerSecret(
      this,
      'sonar-secret-manager',
      {
        provider: this.primaryProvider,
        name: 'sonar-security-secret',
      }
    );
    new SecretsmanagerSecretVersion(this, 'sm-secret-version', {
      provider: this.primaryProvider,
      secretId: secretManager.id,
      secretString: sopsData.RDS_CONFIG_CREDS.sonar.password,
    });

    this.ecs = new DfEcsConstruct(this, 'sonar-ecs-fargate', {
      provider: this.primaryProvider,
      clusterConfig: {
        providers: [this.primaryProvider],
        clusterName: `SonarQube`,
        clusterConfiguration: {
          execute_command_configuration: {
            logging: 'OVERRIDE',
            log_configuration: {
              cloud_watch_log_group_name: sonarQubeLogGroup.name,
            },
          },
        },
        clusterSettings: {
          name: 'containerInsights',
          value: 'enabled',
        },
      },
      volumeConfig: [
        {
          name: 'sonarqube-data',
          efsVolumeConfiguration: {
            fileSystemId: efs.efsId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: efs.accessPointIds[0],
              iam: 'ENABLED',
            },
          },
        },
      ],
      taskConfig: {
        taskName: 'sonarqube',
        subnets: this.sonarConfig.vpc.appSubnetIds,
        securityGroups: [sonarSg],
        cpu: '4096',
        memory: '16384',
        launchType: 'FARGATE',
        taskRoleArn: role.role.arn,
        containerDef: JSON.stringify([
          {
            name: 'sonarqube',
            image: `${this.stackConfig.federatedAccountId}.dkr.ecr.${currRegion.name}.amazonaws.com/sonarqube:latest`,
            cpu: 4096,
            memory: 16384,
            memoryReservation: 16384,
            command: [],
            portMappings: [
              {
                name: 'sonarqube-9000-tcp',
                containerPort: 9000,
                hostPort: 9000,
                protocol: 'tcp',
                appProtocol: 'http',
              },
            ],
            mountPoints: [
              {
                sourceVolume: 'sonarqube-data',
                containerPath: '/opt/sonarqube/data',
              },
              {
                sourceVolume: 'sonarqube-data',
                containerPath: '/opt/sonarqube/extensions',
              },
              {
                sourceVolume: 'sonarqube-data',
                containerPath: '/opt/sonarqube/logs',
              },
            ],
            essential: true,
            environment: [
              {
                name: 'SONAR_JDBC_URL',
                value: `jdbc:postgresql://${auroraDb.rdsClusterResource.endpoint}:5432/postgres`,
              },
              {
                name: 'SONAR_JDBC_USERNAME',
                value: 'sonaradmin',
              },
              {
                name: 'SONAR_SEARCH_JAVAADDITIONALOPTS',
                value:
                  '-Dnode.store.allow_mmap=false,-Ddiscovery.type=single-node',
              },
              {
                name: 'SONAR_SCANNER_OPTS',
                value:
                  '-Xmx6124m -XX:MaxPermSize=512m -XX:ReservedCodeCacheSize=128m',
              },
              {
                name: 'SONAR_WEB_JAVAOPTS',
                value: '-Xmx2124m -Xms2124m -XX:ReservedCodeCacheSize=128m',
              },
              {
                name: 'SONAR_CE_JAVAOPTS',
                value: '-Xmx2124m -Xms2124m -XX:ReservedCodeCacheSize=128m',
              },
              {
                name: 'SONAR_SEARCH_JAVAOPTS',
                value: '-Xmx2124m -Xms2124m -XX:ReservedCodeCacheSize=128m',
              },
            ],
            secrets: [
              {
                name: 'SONAR_JDBC_PASSWORD',
                valueFrom: secretManager.arn,
              },
            ],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-create-group': 'true',
                'awslogs-group': sonarQubeLogGroup.name,
                'awslogs-region': currRegion.name,
                'awslogs-stream-prefix': 'ecs',
              },
            },
            ulimits: [
              {
                name: 'nofile',
                softLimit: 65535,
                hardLimit: 65535,
              },
            ],
          },
        ]),
      },
      loadBalancerConfig: {
        targetGroupMap: [
          {
            port: 9000,
            targetGroupArn: this.sonarConfig.targetGroupArn,
          },
        ],
      },
    });
  }
}
