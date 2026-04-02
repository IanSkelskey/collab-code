const { handleExecConnection } = require('./session.cjs');
const {
  isJavaAvailable,
  getJavaRuntimeVersion,
  isPythonAvailable,
  getPythonRuntimeVersion,
} = require('./runtimeRegistry.cjs');
const {
  getExecutionSandboxStatus,
  isExecutionAllowed,
  isExecutionSandboxed,
} = require('./sandbox.cjs');

module.exports = {
  handleExecConnection,
  isJavaAvailable,
  getJavaRuntimeVersion,
  isPythonAvailable,
  getPythonRuntimeVersion,
  isExecutionAllowed,
  isExecutionSandboxed,
  getExecutionSandboxStatus,
};
