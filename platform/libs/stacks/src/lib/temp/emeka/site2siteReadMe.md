# Guide to configure Site-to-Site VPN with LibreSwan
https://s3.ap-south-1.amazonaws.com/www.awswithchetan.com/AWS-VPC-Networking/AWS+Site-to-Site+VPN+Setup+-+v2.0.pdf

> Ensure you've deployed the site to site vpn stack before proceeding with the configuration.

### Gateway VPC Configuration

- Configure the Site 2 Site VPN in the Prod or when possible Non Prod Shared Network Account
- Ensure target gateway type is transit gateway
- Select the Edge TGW as the target gateway
- Click the radial for new Customer Gateway. The ip address is the public ip of the LibreSwan instance you deployed. Leave the certificate arn blank and BGP ASN as default
- Select static for the routing option as I don't think Libre Swan supports BGP (I could be wrong)
- Leave everything else as default and click create
- Download the config afterwards as we'll need it for the LibreSwan configuration
- Update the gateway vpc's private route tables (private 1, 2 and 3) to route the CIDR of the VPC that Libre Swan is deployed to through the Private NAT Gateways
- Update the gateway vpc's customer edge route tables to route the CIDR of the VPC that Libre Swan is deployed to through the Edge TGW
- Update the edge TGW RTB to route the CIDR of the VPC that Libre Swan is deployed to through the VPN TGW attachment
- Download the site to site VPN config. The vendor to download is going to be Openswan, leave everything else the same

### LibreSwan Configuration, we're only configuring IPSEC Tunnel #1

- Open the S2S config you downloaded from the AWS console. Change **conn Tunnel1** to **conn aws-vpn**
- Delete **auth=esp** from the config
- Change **phase2alg=aes128-sha1;modp1024** to **phase2alg=aes128-sha1;modp2048** and **ike=aes128-sha1;modp1024** to **ike=aes128-sha1;modp2048**
- Update **leftsubnet=< LOCAL NETWORK >** to **leftsubnet=< Libre Swan VPC CIDR >** and **rightsubnet=< REMOTE NETWORK >** to **rightsubnet=< Gateway VPC CIDR >**
- Follow the instructions for IPSEC Tunnel #1. Do the things in the LibreSwan Ec2 instance

- If the above config doesn't work, try templating after this one:
  
```
conn Tunnel1
        authby=secret
        auto=start
        left=%defaultroute
        leftid=34.200.225.95
        right=3.21.0.118
        type=tunnel
        ikelifetime=8h
        keylife=1h
        phase2alg=aes_gcm
        ike=aes256-sha1
        keyingtries=%forever
        keyexchange=ike
        leftsubnet=10.200.0.0/16
        rightsubnet=0.0.0.0/0
        dpddelay=10
        dpdtimeout=30
        dpdaction=restart_by_peer
        encapsulation=yes
```

- systemctl start ipsec to connect the tunnel

### Testing
Ping from a source instance to the private ip of the LibreSwan instance. Ensure proper routing is in place and the tunnel is up

### IPSEC flags
        start                   stop
        restart                 status
        trafficstatus           traffic
        globalstatus            shuntstatus
        briefstatus             showstates
        fips                    import
        initnss                 checknss
        checknflog              addconn
        algparse                auto
        barf                    cavp
        ecdsasigkey             getpeercon_server
        letsencrypt             look
        newhostkey              pluto
        readwriteconf           rsasigkey
        setup                   showhostkey
        showroute               whack
