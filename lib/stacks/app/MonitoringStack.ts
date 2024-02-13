// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import { MonitoringFacade, SnsAlarmActionStrategy, DefaultDashboardFactory, DashboardRenderingPreference, MonitoringNamingStrategy } from 'cdk-monitoring-constructs';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

interface Props extends cdk.StackProps {
  stageName: string;
  applicationName: string;
  applicationQualifier: string;
}

export class MonitoringStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const monitoringTopic = new sns.Topic(this, 'MonitoringTopic', {
      masterKey: new kms.Key(this, 'KMSKey', {
        enableKeyRotation: true,
        alias: `${props.applicationName}-${props.stageName}-Monitoring-key`,
      }),
    });

    monitoringTopic.grantPublish(new iam.AccountRootPrincipal);

    new MonitoringNamingStrategy({
      humanReadableName: props.applicationName,
    });

    const monitoring = new MonitoringFacade(this, 'MonitoringFacade', {
      alarmFactoryDefaults: {
        actionsEnabled: true,
        alarmNamePrefix: `${props.applicationName}-${props.stageName}`,
        action: new SnsAlarmActionStrategy({
          onAlarmTopic: monitoringTopic,
        }),
        datapointsToAlarm: 1,
      },
      metricFactoryDefaults: {
        namespace: `${props.applicationQualifier}`,
      },
      dashboardFactory: new DefaultDashboardFactory(this, 'DashboardFactory', {
        dashboardNamePrefix: `${props.applicationName}-${props.stageName}`,
        createDashboard: true,
        createSummaryDashboard: false,
        createAlarmDashboard: true,
        renderingPreference: DashboardRenderingPreference.INTERACTIVE_ONLY,
      }),
    });

    monitoring.monitorScope(scope, {
      s3: { enabled: true },
      lambda: {
        enabled: true,
        props: {
          alarmFriendlyName: `${props.applicationName}-${props.stageName}`,
        },
      },
    });

    new cdk.CfnOutput(this, 'MonitoringTopicArnCfnOutput', {
      value: monitoringTopic.topicArn,
      description: 'The ARN of the monitoring topic',
      exportName: `${props.applicationName}-${props.stageName}-monitoringTopicArn`,
    });

    new cdk.CfnOutput(this, 'MonitoringTopicNameCfnOutput', {
      value: monitoringTopic.topicName,
      description: 'The name of the monitoring topic',
      exportName: `${props.applicationName}-${props.stageName}-monitoringTopicName`,
    });
  }
}
