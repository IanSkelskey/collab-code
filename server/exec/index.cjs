const { handleExecConnection } = require('./session.cjs');
const { getCapabilities } = require('./runtimeRegistry.cjs');
const {
  getExecutionSandboxStatus,
  isExecutionAllowed,
  isExecutionSandboxed,
} = require('./sandbox.cjs');

module.exports = {
  handleExecConnection,
  getCapabilities,
  isExecutionAllowed,
  isExecutionSandboxed,
  getExecutionSandboxStatus,
};
