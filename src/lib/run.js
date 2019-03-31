const path = require('path')
const dotenv = require('dotenv')
const cliInstance = require('./cli')
const Context = require('./context')
const ComponentDeclarative = require('./componentDeclarative/serverless')
const {
  errorHandler,
  fileExists,
  readFile,
  coreComponentExists,
  loadComponent,
  addEnvVarsToCredentials
} = require('../utils')

/**
 * Run a serverless.js file
 * @param {String} filePath - Path of the declarative file
 * @param {Object} config - Configuration
 */

const runProgrammatic = async (filePath, config) => {

  // Load Component
  const context = new Context(config)

  const Component = require(filePath)

  // Config CLI
  cliInstance.config({
    stage: config.stage,
    parentComponent: Component.name
  })

  const component = new Component({ context, cli: cliInstance })

  try {
    // If method was provided, but doesn't exist, throw error
    if (config.method && !component[config.method]) {
      throw new Error(`Component "${Component.name}" does not have a "${config.method}" method`)
    }

    if (!config.method) {
      return await component()
    } else {
      return await component[config.method]()
    }
  } catch (error) {
    return errorHandler(error, Component.name)
  }
}

/**
 * Run a serverless.yml, serverless.yaml or serverless.json file
 * @param {String} filePath - Path of the declarative file
 * @param {Object} config - Configuration
 */

const runDeclarative = async (filePath, config) => {
  let Component, component

  const context = new Context(config, path.basename(filePath))

  // TODO: Handle loading errors and validate...
  const fileContent = await readFile(filePath)

  // If no config.method or config.instance has been provided, run the default method...
  if (!config.instance && !config.method) {

    // Config CLI
    cliInstance.config({
      stage: config.stage,
      parentComponent: fileContent.name
    })

    try {
      component = new ComponentDeclarative({
        name: fileContent.name, // Must pass in name to ComponentDeclaractive
        context,
        cli: cliInstance,
      })
      return await component()
    } catch (error) {
      return errorHandler(error, fileContent.name)
    }
  }

  // If config.method has been provided, run that...
  if (!config.instance && config.method) {
    // Config CLI
    cliInstance.config({
      stage: config.stage,
      parentComponent: fileContent.name
    })

    component = new ComponentDeclarative({
      name: fileContent.name, // Must pass in name to ComponentDeclaractive
      context,
      cli: cliInstance,
    })
    try {
      return await component[config.method]()
    } catch (error) {
      return errorHandler(error, fileContent.name)
    }
  }

  // If config.method and config.instance, load and run that component's method...
  if (config.instance && config.method) {
    let instanceName
    let componentName

    for (const instance in fileContent.components || {}) {
      const c = instance.split('::')[0]
      const i = instance.split('::')[1]
      if (config.instance === i) {
        instanceName = i
        componentName = c
      }
    }

    // Check Component instance exists in serverless.yml
    if (!instanceName) {
      throw Error(`Component instance "${config.instance}" does not exist in your project.`)
    }

    // Check Component exists
    if (!(await coreComponentExists(componentName))) {
      throw Error(`Component "${componentName}" is not a valid Component.`)
    }

    // Config CLI
    cliInstance.config({
      stage: config.stage,
      parentComponent: fileContent.name
    })

    Component = await loadComponent(componentName)
    component = new Component({
      id: `${context.stage}.${fileContent.name}.${instanceName}`, // Construct correct name of child Component
      context,
      cli: cliInstance,
    })
    try {
      return await component[config.method]()
    } catch (error) {
      return errorHandler(error, componentName)
    }
  }
}

/**
 * Identifies environment variables that are known vendor credentials and finds their corresponding SDK configuration properties
 * @param {Object} config - Configuration
 * @param {String} config.root - The root path of the parent Component.
 * @param {String} config.stage - The stage you wish to set in the context.
 * @param {String} config.instance - The instance name of an immediate child Component you want to target with the CLI.  Note: This only works with serverless.yml
 * @param {String} config.method - The method you want to call on the parent Component.
 * @param {Object} config.credentials - The credentials you wish to set in the context.
 * @param {String} config.verbose - If you wish to see outputs of all child Components.
 * @param {String} config.debug - If you wish to turn on debug mode.
 */

const run = async (config = {}) => {

  // Configuration defaults
  config.root = config.root || process.cwd()
  config.stage = config.stage || 'dev'
  config.credentials = config.credentials || {}
  config.instance = config.instance || null
  config.method = config.method || null

  if (config.verbose) {
    process.env.SERVERLESS_VERBOSE = true
  }
  if (config.debug) {
    process.env.SERVERLESS_DEBUG = true
  }

  // Load env vars
  let envVars = {}
  const defaultEnvFilePath = path.join(config.root, `.env`)
  const stageEnvFilePath = path.join(config.root, `.env.${config.stage}`)
  if (await fileExists(stageEnvFilePath)) {
    envVars = dotenv.config({ path: path.resolve(stageEnvFilePath) }).parsed || {}
  } else if (await fileExists(defaultEnvFilePath)) {
    envVars = dotenv.config({ path: path.resolve(defaultEnvFilePath) }).parsed || {}
  }

  // Add environment variables to credentials
  config.credentials = addEnvVarsToCredentials(envVars, config.credentials)

  // Determine programmatic or declarative usage
  const serverlessJsFilePath = path.join(config.root, 'serverless.js')
  const serverlessYmlFilePath = path.join(config.root, 'serverless.yml')
  const serverlessYamlFilePath = path.join(config.root, 'serverless.yaml')
  const serverlessJsonFilePath = path.join(config.root, 'serverless.json')

  let outputs
  try {
    if (await fileExists(serverlessJsFilePath)) {
      outputs = await runProgrammatic(serverlessJsFilePath, config)
    } else if (await fileExists(serverlessYmlFilePath)) {
      outputs = await runDeclarative(serverlessYmlFilePath, config)
    } else if (await fileExists(serverlessYamlFilePath)) {
      outputs = await runDeclarative(serverlessYamlFilePath, config)
    } else if (await fileExists(serverlessJsonFilePath)) {
      outputs = await runDeclarative(serverlessJsonFilePath, config)
    } else {
      throw new Error(
        `No Serverless file (serverless.js, serverless.yml, serverless.yaml or serverless.json) found in ${config.root}`
      )
    }
  } catch (error) {
    return errorHandler(error, 'Serverless Components')
  }

  // Cleanup CLI
  setTimeout(() => {
    cliInstance.close('done')
  }, 200)

  return outputs
}

/**
 * Run a serverless.yml, serverless.yaml or serverless.json file
 * @param {String} filePath - Path of the declarative file
 * @param {Object} config - Configuration
 */

module.exports = run
