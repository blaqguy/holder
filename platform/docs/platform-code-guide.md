# Platform Code Guide

## About

This is a brief guide on the _current_ code structure and design philosophy. I must stress this is not a mandate, just an overview of the current thinking. Anything can change.

## Repository layout

The platform mono repo is broken up into two major parts. Apps and Libraries. These are contained in the `apps` folder and `libs` folder respectively.

### Libraries

Libraries are intended to contain building blocks or utilities from which to build more complex architectures from. A library on its own should be generic, it should not have any knowledge of environments, regions, really any static values that may pertain to a deployed architecture. Here are some examples of things that you may find in these `libs`.

###### Utilities

A collection of functions or classes that abstract away a nuanced or repetitive process. We may have a function that manages IPAM or formats strings a certain way.

###### Component

An abstraction or wrapper around a **single** resource. This is helpful if we want to enforce certain properties are always set to a certain value. Enforcing a tagging strategy or ensuring something like a TF lifecycle policy is always enabled are good examples of this. The key point tho is it is contained to a single resource. Once we start working with multiple TF resources we enter the next lib.

###### Constructs

Custom constructs are very similar to the previous library, the only distinction is they combine multiple resources into a repeatable pattern. There's really no limitation or guideline on how simple or complex a construct can be, anything that we'd like to abstract or reuse as a pattern is fair game. Some examples you might find are things like:

- Aliased Key
  - A construct that will create a KMS key and an Alias for that Key
- Spoke / Hub VPC
  - Creates an attachable or centralized VPC

###### Stacks

Just like Constructs leverage combining multiple resources into a repeatable unit, Stacks are responsible for orchestrating mulitple constructs and native resources into a deployable unit. Stacks and Constructs are a little bit fuzzy in terms of where the line for a stack ends and the line for a construct begins. However the important thing to note is that stacks correlate to terraform state 1-1 as they wrap the TerraformStack CDK resource. Stacks act as the public interface for a deployable architecture meaning we are deploying stacks and not constructs.

### Apps

Apps are what we would call an architecture. Again the lines for what exists in a single app can be a little grey and it ammitedly doesn't matter that much however my personal viewpoint is that any architecture that is directly responsible for supporting a common product or process should exist in the same app. For example the UOB product needs tons of different environments, each with nuanced differences in AWS resources, but all of that should be contained in one app. If we wanted to do something like build a Platform team WebApp that presented things like, docs, diagrams, various statistics, health metrics, etc in one place...we'd build that out in a separate application. If we needed to create an automated processes to support some team, lets call them the Business Metrics team. This process is not critical to the product or a product feature that would live in a separate app. If that process were intended to be used to support a feature in the UOB product...we'd then build that out in the existing App for UOB.

Writing that out perhaps we should rename the platform app to something like uob-platform....

###### Environments

Environments are pretty self explanatory pieces of the architecture. Environments do not correlate 1-1 with Accounts but they're very close. For example some architecture in the Dev environment may need to create something in the SharedNetwork account, but the majority of the resource in the Dev environment will go into the Dev AWS account. Environments are just logical distinctions between all of the various pieces that go into supporting a product.

## Code Structure

With that overview lets go through each piece talking about how it relates to the next.

**Apps** _have many_ **Environments**
**Environments** _have many_ **Stacks**
**Stacks** _have many_ **Constructs, Components and Resources**
**Constructs** _have many_ **Components and Resources**
**Components** _have ONE_ **Resource**

### Build / Deploy Process

I think before talking about how things currently work at runtime its important to understand how we get to that runtime. The current philosophy for our build / deploy process is that the state of any given environment should correlate to _terraform apply_-able deployment artifact. Therefore each environment goes through a build process prior to deploy.

`nx build platform -c <environment>`

Will create a compiled artifact in `dist/apps/platform`

`cdktf list/apply/plan/destroy`

The cdktf.json is setup to point to the `main.js` file in that distribution.

Each artifact should have in it all of the stacks necessary to deploy that artifact. This means that stacks that are commonly shared, like the SharedNetwork's VPN, are embedded into each artifact. This is because we are currently using Cross-Stack references to pass information around between stacks. The trade-off here is that the code is pretty easy to understand but multiple different artifacts have the ability to slightly modify the outputs of those shared stacks. Which I think currently is a fine tradeoff

The automation process is much the same, it will build the artifact for each Environment and then run a deploy on each.

### Inputs / Outputs

So now that we've gone through each library / app lets talk about what each piece expects to intake and output. Starting from the top:
As a general rule we've opted for using explicit Constructor Injection to resolve our dependencies. We had implemented TSyringe to do this for us but opted for something more explicit.

```
    this.dragonflyApp = new App();

    new Environment(this.dragonflyApp);
```

Each Environment expects to be handed the top level CDK App. The Environments should implement the `abstractEnvironment` class. This expects a method `createStacks` to be implemented which should do exactly what it says. Doing this will inject the correct AWS provider into each stack created here. Every value that needs to be passed to those stacks should be defined as Static members of the Environment class. Each stack should export an interface with the configurations it expects to receive. This pattern of exposing an interface for the configuration to be passed to the constructor should be followed down to the resource level.

Working our way back up, every building block should expose the TF resources they create. Each resource should be assigned to a private readonly value in the class and the class should expose a public getter for that value.

```
export class MyStack {
  private readonly someThing: TerraformResource

  constructor() {
    this.someThing = new TerraformResource()
  }

  public get someThingResource() {
    return this.someThing;
  }
}
```

We've opted for this pattern to make it a bit more clear when you're working with a Terraform resource as opposed to some object that exists at runtime.

### Cross Stack References

Currently we have 2 major patterns for cross stack references.

1. Cross stack references within the same environment / account
2. Cross stack references across envrionments / accounts

The first one is very straightforward.

```
this.devSandboxVpc = new SpokeVpcStack(DeveloperSandboxEnvironment.VPC_CIDR);

PrivateInstance.windowsInstance(this.devSandboxVpc);
```

Like you would expect we just pass one stack into the constructor for the dependent stack and then reference its resources from the getters it exposes.

Cross stack references across environments is a bit more complicated. Firstly because of this additional complexity, these references are contained in a seprate location, currently `apps/platform/src/environmentHelpers`. The classes here exist to orchestrate the various resources that may need to be deployed to an account that is different than the default account for a given stack. The implementation pattern for these classes is as follows:

1. The Orchestration class should expect to be passed the owner stack. This can be an empty stack or something that may already have resources.

```
export class SpokeAttachment {
  constructor(
    private ownerStack: TerraformStack,
    private attachmentOrchestrator: VpcAttachmentOrchestrator
  ) {
```

2. An interface that outlines the required resources

```
export interface VpcAttachmentOrchestrator {
  injectProviderForStack: (stack: TerraformStack) => TerraformProvider;
  transitGatewayResource: Ec2TransitGateway;
  sharedVpcResource: HubVpc;
  spokeRouteTable: Ec2TransitGatewayRouteTable;
  hubRouteTable: Ec2TransitGatewayRouteTable;
}
```

Given that we are working with cross account needs, this interface should always include the expectation of a provider: `injectProviderForStack: (stack: TerraformStack) => TerraformProvider;` This is how providers for accounts other than the default are injected into the given stack.
