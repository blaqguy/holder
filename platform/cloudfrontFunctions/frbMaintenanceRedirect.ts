import { Constants } from '../libs/utils/src/lib/constants';

const whitelist = [...Constants.FRB_SHORT_WHITELIST];
const commaSeparatedWhitelist = whitelist.map((ip) => `'${ip}'`).join(',');

export const frbMaintenanceRedirectFunction = `
async function handler(event) {
  function ipIsInCidr(ip, cidr) {
      const cidrIp = cidr.split('/')[0];
      const cidrSm = cidr.split('/')[1];
      return (ipNumber(ip) & ipMask(cidrSm)) == ipNumber(cidrIp);
  }

  function ipNumber(IPaddress) {
      const ip = IPaddress.match(/^(\\d+).(\\d+).(\\d+).(\\d+)$/);
      if (ip) {
        return (+ip[1] << 24) + (+ip[2] << 16) + (+ip[3] << 8) + (+ip[4]);
      }

      return null;
  }

  function ipMask(maskSize) {
      return -1 << (32 - maskSize);
  }

  function ipIsInAnyCidr(ip, cidrRanges) {
      for (let i = 0; i < cidrRanges.length; i++) {
          if (ipIsInCidr(ip, cidrRanges[i])) {
              return true;
          }
      }

      return false;
  }

  const whitelist = [${commaSeparatedWhitelist}];

  if (!ipIsInAnyCidr(event.viewer.ip, whitelist)) {
    const response = {
      statusCode: 302,
      statusDescription: 'Found',
      headers: {
        location: {
          value:
            'https://www.firstrepublic.com/maintenance/corporate-online-banking/unavailable',
        },
      },
    };

    return response;
  }
  
  return event.request;
}
`;
