import { equals, is, resolve, sleep, or, resolvable, not, pick, keys } from '@serverless/utils'

const attachRolePolicy = async (IAM, { roleName, policy }) => {
  await IAM.attachRolePolicy({
    RoleName: roleName,
    PolicyArn: policy.arn
  }).promise()

  return sleep(15000)
}

const detachRolePolicy = async (IAM, { roleName, policy }) => {
  await IAM.detachRolePolicy({
    RoleName: roleName,
    PolicyArn: policy.arn
  }).promise()
}

const createRole = async (IAM, { roleName, service, policy }) => {
  const assumeRolePolicyDocument = {
    Version: '2012-10-17',
    Statement: {
      Effect: 'Allow',
      Principal: {
        Service: service
      },
      Action: 'sts:AssumeRole'
    }
  }
  const roleRes = await IAM.createRole({
    RoleName: roleName,
    Path: '/',
    AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument)
  }).promise()

  await attachRolePolicy(IAM, {
    roleName,
    policy
  })

  return roleRes.Role.Arn
}

const deleteRole = async (IAM, { roleName, policy }) => {
  try {
    await detachRolePolicy(IAM, {
      roleName,
      policy
    })
  } catch (error) {
    if (error.message !== `Policy ${policy.arn} was not found.`) {
      throw error
    }
  }

  await IAM.deleteRole({
    RoleName: roleName
  }).promise()

  return null
}

const updateAssumeRolePolicy = async (IAM, { roleName, service }) => {
  const assumeRolePolicyDocument = {
    Version: '2012-10-17',
    Statement: {
      Effect: 'Allow',
      Principal: {
        Service: service
      },
      Action: 'sts:AssumeRole'
    }
  }
  await IAM.updateAssumeRolePolicy({
    RoleName: roleName,
    PolicyDocument: JSON.stringify(assumeRolePolicyDocument)
  }).promise()
}

const AwsIamRole = async (SuperClass, superContext) => {
  const AwsIamPolicy = await superContext.loadType('AwsIamPolicy')

  return class extends SuperClass {
    async construct(inputs, context) {
      await super.construct(inputs, context)

      // HACK BRN: Temporary workaround until we add property type/default support
      const defaultPolicy = {
        arn: 'arn:aws:iam::aws:policy/AdministratorAccess'
      }
      this.provider = inputs.provider
      this.service = inputs.service
      this.policy = resolvable(() => or(inputs.policy, defaultPolicy))
      this.roleName = resolvable(() => or(inputs.roleName, `role-${this.instanceId}`))
    }

    shouldDeploy(prevInstance) {
      const inputs = {
        roleName: resolve(this.roleName),
        service: resolve(this.service),
        policy: resolve(this.policy)
      }
      const prevInputs = prevInstance ? pick(keys(inputs), prevInstance) : {}
      const configChanged = not(equals(inputs, prevInputs))
      if (prevInstance && prevInstance.roleName !== inputs.roleName) {
        return 'replace'
      } else if (!prevInstance || configChanged) {
        return 'deploy'
      }
    }

    async define() {
      const policy = resolve(this.policy)
      if (is(AwsIamPolicy.class, policy)) {
        return {
          policy
        }
      }
      return {}
    }

    async deploy(prevInstance, context) {
      const provider = this.provider
      const AWS = provider.getSdk()
      const IAM = new AWS.IAM()

      if (!prevInstance || this.roleName !== prevInstance.roleName) {
        context.log(`Creating Role: ${this.roleName}`)
        this.arn = await createRole(IAM, {
          roleName: this.roleName,
          service: this.service,
          policy: this.policy
        })
      } else {
        if (prevInstance.service !== this.service) {
          await updateAssumeRolePolicy(IAM, this)
        }
        if (!equals(prevInstance.policy, this.policy)) {
          await detachRolePolicy(IAM, prevInstance)
          await attachRolePolicy(IAM, { roleName: this.roleName, policy: this.policy })
        }
      }
    }

    async remove(context) {
      const provider = this.provider
      const AWS = provider.getSdk()
      const IAM = new AWS.IAM()

      try {
        context.log(`Removing Role: ${this.roleName}`)
        this.arn = await deleteRole(IAM, this)
      } catch (e) {
        if (!e.message.includes('Role not found')) {
          throw e
        }
      }
    }

    async info() {
      return {
        title: this.roleName,
        type: this.extends,
        data: {
          arn: this.arn,
          service: this.service,
          policy: this.policy
        }
      }
    }
  }
}

export default AwsIamRole
