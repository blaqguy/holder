export type PlatformSecrets = {
  NEW_RELIC_ACCOUNT_ID: number;
  NEW_RELIC_API_KEY: string;
  NEW_RELIC_LICENSE_KEY: string;
  TEAMS_INCOMING_WEBBOOK: string;
  DD_API_KEY: string;
  DD_APP_KEY: string;
  PRISMA_API_KEY: {
    'prisma-df-org-api-access-key': string;
    'prisma-df-org-api-secret-key': string;
  };
  RDS_CONFIG_CREDS: {
    uc4: {
      username: string;
      password: string;
    };
    testingStack: {
      username: string;
      password: string;
    };
    santist1upf: {
      username: string;
      password: string;
    };
    dbupewi3upf: {
      username: string;
      password: string;
    };
    dbewbkuob: {
      username: string;
      password: string;
    };
    moveit: {
      username: string;
      password: string;
    };
    sonar: {
      username: string;
      password: string;
    };
  };
  EMEKA_GITHUB_PA_TOKEN: string;
  NON_PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS: {
    app: {
      usfiname: string;
    };
    mq: {
      mqm: string;
      usfiname: string;
    };
    msi: {
      usrsvs: string;
      usfiname: string;
    };
    rpt: {
      usrrpt: string;
    };
    web: {
      ihsadmin: string;
    };
    rt: {
      usfiname: string;
    };
  };
  PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS: {
    app: {
      usfiname: string;
    };
    mq: {
      mqm: string;
      usfiname: string;
    };
    msi: {
      usrsvs: string;
      usfiname: string;
    };
    rpt: {
      usrrpt: string;
    };
    web: {
      ihsadmin: string;
    };
    rt: {
      usfiname: string;
    };
  };
  JENKINS_SECRET: {
    platformSandbox: string;
    qe: string;
    performance: string;
    ist: string;
    sharedUat: string;
    sharedProd: string;
  };
  JENKINS_SSO: {
    tenant: string;
    clientId: string;
    clientSecret: string;
  };
  SENTINEL_ONE: {
    api_key: string;
    site_token: string;
  };
  DOMAIN_ADMIN_PW: string;
  MOVEIT: {
    transfer_serial_number: string;
    transfer_serial_number_dr: string;
    automation_serial_number: string;
    automation_serial_number_dr: string;
  };
  GITHUB_ACTIONS_RUNNER_TOKEN: string;
  CYBER_ARK_PSM_CERT_PRIVATE_KEY: string;
};

export const SECRETS: PlatformSecrets = {
  NEW_RELIC_ACCOUNT_ID: 123456,
  NEW_RELIC_API_KEY: 'dummydataapikey',
  NEW_RELIC_LICENSE_KEY: 'dummydatalicensekey',
  TEAMS_INCOMING_WEBBOOK: 'dummydatawebhook',
  DD_API_KEY: 'dummydataapikey',
  DD_APP_KEY: 'dummydataappkey',
  PRISMA_API_KEY: {
    'prisma-df-org-api-access-key': 'dummydataaccesskey',
    'prisma-df-org-api-secret-key': 'dummydatasecretkey',
  },
  RDS_CONFIG_CREDS: {
    uc4: {
      username: 'UC4dummydatausername',
      password: 'UC4dummydatapassword',
    },
    testingStack: {
      username: 'dummydatausername',
      password: 'dummydatapassword',
    },
    santist1upf: {
      username: 'dummydatausername',
      password: 'dummydatapassword',
    },
    dbupewi3upf: {
      username: 'dummydatausername',
      password: 'dummydatapassword',
    },
    dbewbkuob: {
      username: 'dummydatausername',
      password: 'dummydatapassword',
    },
    moveit: {
      username: 'dummydatausername',
      password: 'dummydatapassword',
    },
    sonar: {
      username: 'dummydatausername',
      password: 'dummydatapassword',
    },
  },
  EMEKA_GITHUB_PA_TOKEN: 'dummydatapa',
  NON_PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS: {
    app: {
      usfiname: 'dummydatausfiname',
    },
    mq: {
      mqm: 'dummydatamqm',
      usfiname: 'dummydatausfiname',
    },
    msi: {
      usrsvs: 'dummydatausrsvs',
      usfiname: 'dummydatausfiname',
    },
    rpt: {
      usrrpt: 'dummydatausrrpt',
    },
    web: {
      ihsadmin: 'dummydataihsadmin',
    },
    rt: {
      usfiname: 'dummydatausfiname',
    },
  },
  PROD_UOB_SERVICE_ACCOUNTS_PASSWORDS: {
    app: {
      usfiname: 'dummydatausfiname',
    },
    mq: {
      mqm: 'dummydatamqm',
      usfiname: 'dummydatausfiname',
    },
    msi: {
      usrsvs: 'dummydatausrsvs',
      usfiname: 'dummydatausfiname',
    },
    rpt: {
      usrrpt: 'dummydatausrrpt',
    },
    web: {
      ihsadmin: 'dummydataihsadmin',
    },
    rt: {
      usfiname: 'dummydatausfiname',
    },
  },
  JENKINS_SECRET: {
    platformSandbox: 'dummydatajenkinssecret',
    qe: 'dummydatajenkinssecret',
    ist: 'dummydatajenkinssecret',
    performance: 'foo',
    sharedUat: '🤠',
    sharedProd: 'test',
  },
  JENKINS_SSO: {
    tenant: 'foo',
    clientId: 'foo',
    clientSecret: 'foo',
  },
  SENTINEL_ONE: {
    api_key: 'dummydataapikey',
    site_token: 'dummydatasitetoken',
  },
  DOMAIN_ADMIN_PW: 'dummydataadminpw',
  MOVEIT: {
    transfer_serial_number: 'ABCDEFGHIJKLMNOP',
    transfer_serial_number_dr: 'ABCDEFGHIJKLMNOP',
    automation_serial_number: 'ABCDEFGHIJKLMNOP',
    automation_serial_number_dr: 'ABCDEFGHIJKLMNOP',
  },
  GITHUB_ACTIONS_RUNNER_TOKEN: 'value',
  CYBER_ARK_PSM_CERT_PRIVATE_KEY: 'dummydata'
};
