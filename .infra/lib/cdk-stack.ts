import * as cdk from 'aws-cdk-lib';
import {
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_secretsmanager as secretsmanager,
  aws_rds as rds,
  aws_iam as iam,
} from 'aws-cdk-lib';
import * as appRunner from '@aws-cdk/aws-apprunner-alpha';

export class MyStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * VPC
     */
    const vpc = new ec2.Vpc(this, 'VPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    /**
     * Security groups
     */
    const appRunnerSecurityGroup = new ec2.SecurityGroup(
      this,
      'AppRunnerSecurityGroup',
      {
        vpc,
      },
    );
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
      vpc,
    });
    rdsSecurityGroup.addIngressRule(appRunnerSecurityGroup, ec2.Port.tcp(3306));

    /**
     * RDS
     */
    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_33,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      allocatedStorage: 20,
      securityGroups: [rdsSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret('admin', {
        secretName: 'AppRunnerRdsSecret',
      }),
      databaseName: 'appRunner',
    });

    /**
     * IAM
     */
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });
    const accessRole = new iam.Role(this, 'AppRunnerECRAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess',
        ),
      ],
    });

    /**
     * AppRunner
     */
    const secret = dbInstance.secret!;
    const vpcConnector = new appRunner.VpcConnector(this, 'VpcConnector', {
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
      securityGroups: [appRunnerSecurityGroup],
    });
    const appRunnerService = new appRunner.Service(this, 'AppRunnerService', {
      cpu: appRunner.Cpu.QUARTER_VCPU,
      memory: appRunner.Memory.ONE_GB,
      vpcConnector,
      accessRole: accessRole,
      instanceRole: instanceRole,
      autoDeploymentsEnabled: true,
      source: appRunner.Source.fromEcr({
        imageConfiguration: {
          port: 3000,
          environmentSecrets: {
            DB_HOST: appRunner.Secret.fromSecretsManager(secret, 'host'),
            DB_PORT: appRunner.Secret.fromSecretsManager(secret, 'port'),
            DB_NAME: appRunner.Secret.fromSecretsManager(secret, 'dbname'),
            DB_USERNAME: appRunner.Secret.fromSecretsManager(
              secret,
              'username',
            ),
            DB_PASSWORD: appRunner.Secret.fromSecretsManager(
              secret,
              'password',
            ),
          },
        },
        repository: ecr.Repository.fromRepositoryName(
          this,
          'AppRunnerRepository',
          'app_runner',
        ),
      }),
    });

    new cdk.CfnOutput(this, 'serviceUrl', {
      value: appRunnerService.serviceUrl,
      exportName: 'serviceUrl',
    });
  }

  get availabilityZones(): string[] {
    return ['ap-northeast-1a', 'ap-northeast-1c'];
  }
}
