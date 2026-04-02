const { javaRunner } = require('./runtimes/java.cjs');
const { pythonRunner } = require('./runtimes/python.cjs');

const runners = [javaRunner, pythonRunner];
const runnersByLanguage = new Map(runners.map((runner) => [runner.language, runner]));

function getRunner(language) {
  return runnersByLanguage.get(language) ?? null;
}

function resolveExecutionLanguage(message, files) {
  if (message.language && runnersByLanguage.has(message.language)) {
    return message.language;
  }

  if (message.mainClass) {
    return 'java';
  }

  for (const runner of runners) {
    if (runner.canHandle({ message, files })) {
      return runner.language;
    }
  }

  return null;
}

function isJavaAvailable() {
  return javaRunner.isAvailable();
}

function getJavaRuntimeVersion() {
  return javaRunner.getVersion();
}

function isPythonAvailable() {
  return pythonRunner.isAvailable();
}

function getPythonRuntimeVersion() {
  return pythonRunner.getVersion();
}

module.exports = {
  getRunner,
  resolveExecutionLanguage,
  isJavaAvailable,
  getJavaRuntimeVersion,
  isPythonAvailable,
  getPythonRuntimeVersion,
};
