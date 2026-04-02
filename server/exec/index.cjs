const { handleExecConnection } = require('./session.cjs');
const {
  isJavaAvailable,
  getJavaRuntimeVersion,
  isPythonAvailable,
  getPythonRuntimeVersion,
} = require('./runtimeRegistry.cjs');

module.exports = {
  handleExecConnection,
  isJavaAvailable,
  getJavaRuntimeVersion,
  isPythonAvailable,
  getPythonRuntimeVersion,
};
