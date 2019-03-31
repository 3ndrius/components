const chalk = require('chalk')
const ramda = require('ramda')
const fs = require('./fs')
const sleep = require('./sleep')
const errorHandler = require('./errorHandler')
const addEnvVarsToCredentials = require('./addEnvVarsToCredentials')
const titelize = require('./titelize')

module.exports = {
  ...ramda,
  ...fs,
  sleep,
  errorHandler,
  addEnvVarsToCredentials,
  titelize,
  chalk
}
