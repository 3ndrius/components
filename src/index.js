/*
 * Serverless Components
 */

const { pick } = require('ramda')
const Component = require('./lib/component/serverless')
const run = require('./lib/run')
const utils = require('./utils')

// choose useful utils to export for component author
const utilsToExport = [
  'dirExists',
  'fileExists',
  'hashFile',
  'isArchivePath',
  'isJsonPath',
  'isYamlPath',
  'packDir',
  'parseFile',
  'readFile',
  'readFileIfExists',
  'writeFile',
  'sleep',
  'titelize'
]

module.exports = {
  run,
  Component,
  ...pick(utilsToExport, utils)
}
