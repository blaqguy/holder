import { DfSsmRunPowershellScriptAssociationConstruct as DfSsmRunPowershellScriptAssociationConstruct } from '@dragonfly/constructs';
import { RemoteStack, StackConfig } from '../stacks';
import { Constants } from '@dragonfly/utils';

interface DfWindowsNetworkSensorAgentAssociationConfig {
  regionAlias: Constants.AWS_REGION_ALIASES;
}

/**
 * Creates SSM Association that installs the Network Sensor Windows Agent
 * The installer is pulled from an S3 bucket created by dfWindowsNetworkSensorAgentInstallerBucketStack.ts
 * The installer was manually uploaded to that bucket.
 */
export class DfWindowsNetworkSensorAgentAssociationStack extends RemoteStack {
  /**
   *
   * @param {StackConfig} stackConfig
   * @param {string} id
   * @param {DfWindowsNetworkSensorAgentAssociationConfig} config
   */
  constructor(
    stackConfig: StackConfig,
    id: string,
    config: DfWindowsNetworkSensorAgentAssociationConfig
  ) {
    super(id, stackConfig);

    const provider = this.getProviderForRegion(config.regionAlias);

    new DfSsmRunPowershellScriptAssociationConstruct(
      this,
      `network-sensor-install-association`,
      {
        provider: provider,
        targetType: 'tag',
        tagKey: 'os',
        tagValues: ['windows'],
        command: `
        #Requires -RunAsAdministrator

        # Check if the agent is already installed
        $service = Get-Service -Name aella_ctrl -ErrorAction SilentlyContinue

        if ($service) {
            Write-Host "The agent is already installed. Aborting installation."
            exit
        } else {
            Write-Host "The agent is not installed. Continuing installation."
        }

        # The specified NuGet version is a dependency for the AWS PowerShell module
        try {
            Write-Host "Updating NuGet and installing the AWS PowerShell module"
            Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force
            Install-Module -Name AWSPowerShell -Force
        }
        catch {
            Write-Host "An error occurred while updating NuGet and installing the AWS PowerShell module: $_.Exception.Message"
            Exit 1
        }

        try {
            Write-Host "Getting installer from S3 bucket in tools account"
            Read-S3Object -BucketName dft-network-sensor-windows-agent-installer -Key aellads_5.1.1_windows-x64_20240217_b9b5906.msi -File aellads_5.1.1_windows-x64_20240217_b9b5906.msi
        }
        catch {
            Write-Host "An error occurred while getting installer from S3: $_.Exception.Message"
            Exit 1
        }

        try {
            Write-Host "Executing the installer"
            Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "aellads_5.1.1_windows-x64_20240217_b9b5906.msi",  "/quiet", "/norestart", "CM_HOST=briteprotect.brite.com", "TENANT_ID=f750af92ec3a4007aa466ab57a34835c" -Wait
        }
        catch {
            Write-Host "An error occurred while executing installer: $_.Exception.Message"
            Exit 1
        }
        `,
      }
    );
  }
}
