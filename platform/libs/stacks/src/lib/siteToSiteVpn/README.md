This is the readme to setup the vpn gateway, customer gateway, and the site to site vpn connection.
Once you get the client IP and bgp asn, go to the customerConfig.ts file in libs/stack/src/lib/siteToSiteVpn/customerConfig.ts and add the info in the customerConfig object.
Then when the client info is added to the config object, deploy the 'vpn-gateway-${region}' and 'site-to-site-vpn-${region}' stacks.
Add the below code into the sharedNetwork file and update the gatewayVpc info below during the first time deployment.

  <!-- /**
   * Creates the VPN Gateway, customer gateways, and site to site VPN connections
   */
  private createSiteToSiteConnection(): void {
    const vpnGatewayStack = new DfVpnGatewayStack(
      'vpn-gateway-primary',
      this.stackConfig,
      {
        region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
        gatewayVpc:
          this.platformSandboxSharedNetworkStackPrimary.gatewayVpcConstruct,
      }
    );
    new DfSiteToSiteVpnStack('site-to-site-vpn-primary', this.stackConfig, {
      vpnGw: vpnGatewayStack.vpnGateway,
      region: Constants.AWS_REGION_ALIASES.DF_PRIMARY,
      gatewayVpc:
        this.platformSandboxSharedNetworkStackPrimary.gatewayVpcConstruct,
    });
  } -->

An example of the customer config will look like this below. Customer configs will be an object with the customer name as the key and an array containing the customer config objects for the customer. The client objects will need the fiName, a description, wether it is a static connection or not, the customer nat block for static connections (Nat blocks are found in the gatewayVpcConfig file but are not required for dynamic bgp connections), the clients IP, and a bgp asn number (also not required).

  <!-- {
    Example object that can be removed once we get a clients info
    testClient1: [
      {
        fiName: 'alanisTestEwb',
        description: 'mpls1',
        staticConnection: true,
        customerNatBlock: DfAccounts.accounts.platformSandboxSharedNetwork.vpcCidrs.gateway
            .gateway.primary.subnets.clients.eastWestBank.customerNat.uat,
        clientIp: '84.203.115.47',
        bgpAsn: '65021',
      },
    ],
  }; -->
